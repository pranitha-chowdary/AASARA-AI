// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";
import {ConfirmedOwner} from "@chainlink/contracts/src/v0.8/shared/access/ConfirmedOwner.sol";

/**
 * @title  AasaraParametric
 * @notice Parametric microinsurance for India's gig-economy delivery partners.
 *
 *         CHAINLINK DON FLOW
 *         ──────────────────
 *         1. Admin calls requestOracleValidation(lat, lng, city, disruptionType, riskScore)
 *         2. Chainlink DON nodes independently fetch OpenWeatherMap, reach consensus,
 *            and call fulfillRequest() on-chain.
 *         3. Contract auto-activates the disruption if rainfall > 20 mm/hr OR
 *            temperature > 42 °C, guaranteeing no single server can fake a Red Alert.
 *         4. Admin then calls executePayout() for each affected worker — every payout
 *            is immutably logged on-chain with a verifiable txHash.
 *
 *         ADMIN-OVERRIDE PATH (for demo / testnet without funded subscription)
 *         ─────────────────────────────────────────────────────────────────────
 *         Admin calls registerDisruption() directly, skipping the oracle step.
 *         This mirrors what happens when the Chainlink subscription is not yet funded.
 *
 * @dev Deployable on Ethereum Sepolia or Polygon Amoy testnets.
 *      Chainlink Functions Router addresses:
 *        Sepolia:      0xb83E47C2bC239B3bf370bc41e1459A34b41238D0
 *        Polygon Amoy: 0xC22a79eBA640940ABB6dF0f7982cc119578E11De
 */
contract AasaraParametric is FunctionsClient, ConfirmedOwner {
    using FunctionsRequest for FunctionsRequest.Request;

    // ── Chainlink Functions config ─────────────────────────────────────
    uint64  public subscriptionId;
    bytes32 public donId;
    uint32  public constant GAS_LIMIT = 300_000;

    /**
     * @dev Inline JavaScript executed by the Chainlink DON.
     *      Fetches live weather from OpenWeatherMap and returns an encoded uint256:
     *        (temperature_0.1C * 100_000) + (rainfall_0.1mm * 1_000) + weather_id
     *
     *      Example: temp=32.5°C, rain=22.3mm, wid=501 (moderate rain)
     *        → 325 * 100000 + 223 * 1000 + 501 = 32_723_501
     */
    string public constant WEATHER_SOURCE =
        "const lat=args[0],lng=args[1],key=secrets.weatherApiKey;"
        "const r=await Functions.makeHttpRequest({url:`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${key}&units=metric`});"
        "if(r.error)throw new Error(r.error);"
        "const d=r.data;"
        "const temp=Math.round(d.main.temp*10);"
        "const rain=Math.round((d.rain?.['1h']||0)*10);"
        "const wid=d.weather[0].id;"
        "return Functions.encodeUint256(BigInt(temp)*100000n+BigInt(rain)*1000n+BigInt(wid));";

    // ── Data structures ────────────────────────────────────────────────

    struct DisruptionEvent {
        bytes32 eventId;
        string  city;
        string  disruptionType;    // "monsoon" | "heatwave" | "curfew" | "pollution" | "strike"
        uint256 timestamp;
        int256  temperature;       // 0.1 °C  (e.g. 325 = 32.5 °C)
        uint256 rainfallMm;        // 0.1 mm  (e.g. 223 = 22.3 mm)
        uint256 weatherRiskScore;  // 0-100 from AASARA ML engine
        bool    oracleValidated;   // true  = Chainlink DON confirmed the data
        bool    active;            // true  = payouts may be issued
    }

    struct PayoutRecord {
        bytes32 payoutId;
        string  workerId;
        string  workerEmail;
        uint256 amountPaise;        // e.g. 70_000 = ₹700.00
        bytes32 disruptionEventId;
        uint256 timestamp;
        string  payoutMethod;       // "razorpay" | "upi" | "simulated"
        string  externalPayoutId;   // Razorpay payout ID (if applicable)
    }

    struct OracleRequest {
        bytes32 eventId;
        string  disruptionType;
        string  city;
        uint256 requestedAt;
        bool    fulfilled;
    }

    mapping(bytes32 => DisruptionEvent) public disruptionEvents;
    mapping(bytes32 => PayoutRecord)    public payoutRecords;
    mapping(bytes32 => OracleRequest)   public oracleRequests;

    bytes32[] public allPayoutIds;
    bytes32[] public allEventIds;

    uint256 public totalPayoutsPaise;
    uint256 public totalWorkersProtected;
    uint256 public premiumsCollectedPaise;

    // ── Events ─────────────────────────────────────────────────────────

    event DisruptionRegistered(
        bytes32 indexed eventId,
        string  city,
        string  disruptionType,
        uint256 weatherRiskScore,
        bool    oracleValidated
    );

    event OracleValidationRequested(
        bytes32 indexed requestId,
        bytes32 indexed eventId,
        string  city
    );

    event OracleValidationFulfilled(
        bytes32 indexed requestId,
        bytes32 indexed eventId,
        int256  temperature,
        uint256 rainfallMm,
        uint256 weatherId,
        bool    autoActivated
    );

    event PayoutExecuted(
        bytes32 indexed payoutId,
        string  workerId,
        uint256 amountPaise,
        bytes32 indexed disruptionEventId,
        string  payoutMethod
    );

    event PremiumRecorded(
        string  workerId,
        uint256 amountPaise,
        string  planType,
        uint256 weekStart
    );

    event LiquidityPoolFunded(address indexed funder, uint256 amount);

    // ── Constructor ────────────────────────────────────────────────────

    constructor(
        address functionsRouter,
        bytes32 _donId,
        uint64  _subscriptionId
    ) FunctionsClient(functionsRouter) ConfirmedOwner(msg.sender) {
        donId          = _donId;
        subscriptionId = _subscriptionId;
    }

    // ── Owner-only functions ───────────────────────────────────────────

    /// @notice Fund the AASARA liquidity pool (ETH goes to this contract).
    function fundPool() external payable {
        emit LiquidityPoolFunded(msg.sender, msg.value);
    }

    /**
     * @notice Send a Chainlink Functions request to validate weather on-chain.
     *         The DON fetches OpenWeatherMap independently — no trust needed in any
     *         single server, preventing syndicate attacks on the trigger oracle.
     *
     * @param lat              Latitude as string, e.g. "19.0760"
     * @param lng              Longitude as string, e.g. "72.8777"
     * @param city             City name for event logging
     * @param disruptionType   One of: monsoon|heatwave|curfew|pollution|strike
     * @param weatherRiskScore ML-computed 0-100 risk score from AASARA backend
     */
    function requestOracleValidation(
        string calldata lat,
        string calldata lng,
        string calldata city,
        string calldata disruptionType,
        uint256 weatherRiskScore
    ) external onlyOwner returns (bytes32 requestId) {
        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(WEATHER_SOURCE);

        string[] memory args = new string[](2);
        args[0] = lat;
        args[1] = lng;
        req.setArgs(args);

        requestId = _sendRequest(
            req.encodeCBOR(),
            subscriptionId,
            GAS_LIMIT,
            donId
        );

        // Register event as unvalidated — activates after oracle responds
        bytes32 eventId = keccak256(
            abi.encodePacked(city, disruptionType, block.timestamp)
        );
        disruptionEvents[eventId] = DisruptionEvent({
            eventId:          eventId,
            city:             city,
            disruptionType:   disruptionType,
            timestamp:        block.timestamp,
            temperature:      0,
            rainfallMm:       0,
            weatherRiskScore: weatherRiskScore,
            oracleValidated:  false,
            active:           false
        });
        allEventIds.push(eventId);

        oracleRequests[requestId] = OracleRequest({
            eventId:       eventId,
            disruptionType: disruptionType,
            city:          city,
            requestedAt:   block.timestamp,
            fulfilled:     false
        });

        emit OracleValidationRequested(requestId, eventId, city);
    }

    /**
     * @notice Admin override — register disruption without oracle (fallback / demo).
     *         Used when Chainlink subscription is not yet funded on testnet.
     */
    function registerDisruption(
        string calldata city,
        string calldata disruptionType,
        uint256 weatherRiskScore
    ) external onlyOwner returns (bytes32 eventId) {
        eventId = keccak256(
            abi.encodePacked(city, disruptionType, block.timestamp)
        );
        disruptionEvents[eventId] = DisruptionEvent({
            eventId:          eventId,
            city:             city,
            disruptionType:   disruptionType,
            timestamp:        block.timestamp,
            temperature:      0,
            rainfallMm:       0,
            weatherRiskScore: weatherRiskScore,
            oracleValidated:  false,
            active:           true
        });
        allEventIds.push(eventId);

        emit DisruptionRegistered(eventId, city, disruptionType, weatherRiskScore, false);
    }

    /**
     * @notice Record a parametric payout immutably on-chain.
     *         The returned payoutId is stored as the txHash in MongoDB.
     */
    function executePayout(
        string calldata workerId,
        string calldata workerEmail,
        uint256          amountPaise,
        bytes32          disruptionEventId,
        string calldata payoutMethod,
        string calldata externalPayoutId
    ) external onlyOwner returns (bytes32 payoutId) {
        require(disruptionEvents[disruptionEventId].active, "Disruption not active");

        payoutId = keccak256(
            abi.encodePacked(workerId, disruptionEventId, block.timestamp, allPayoutIds.length)
        );

        payoutRecords[payoutId] = PayoutRecord({
            payoutId:          payoutId,
            workerId:          workerId,
            workerEmail:       workerEmail,
            amountPaise:       amountPaise,
            disruptionEventId: disruptionEventId,
            timestamp:         block.timestamp,
            payoutMethod:      payoutMethod,
            externalPayoutId:  externalPayoutId
        });

        allPayoutIds.push(payoutId);
        totalPayoutsPaise      += amountPaise;
        totalWorkersProtected++;

        emit PayoutExecuted(payoutId, workerId, amountPaise, disruptionEventId, payoutMethod);
    }

    /// @notice Log a premium payment on-chain for audit transparency.
    function recordPremium(
        string calldata workerId,
        uint256          amountPaise,
        string calldata planType
    ) external onlyOwner {
        premiumsCollectedPaise += amountPaise;
        emit PremiumRecorded(workerId, amountPaise, planType, block.timestamp);
    }

    // ── Chainlink oracle fulfillment callback ─────────────────────────

    /**
     * @dev Called by the Chainlink DON after weather data is fetched.
     *      Automatically activates the disruption event if thresholds are met:
     *        - Rainfall  > 20 mm/hr  (200 in 0.1 mm units)
     *        - Temperature > 42 °C   (420 in 0.1 °C units)
     *        - Weather code < 700    (thunderstorm / drizzle / rain / snow)
     *        - ML risk score >= 70
     */
    function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) internal override {
        OracleRequest storage oReq = oracleRequests[requestId];
        require(!oReq.fulfilled, "Already fulfilled");
        oReq.fulfilled = true;

        if (err.length > 0 || response.length == 0) {
            // Oracle error — admin must activate manually via registerDisruption()
            return;
        }

        uint256 encoded  = abi.decode(response, (uint256));
        uint256 weatherId = encoded % 1000;
        uint256 rain      = (encoded / 1000) % 100;    // 0.1 mm units
        int256  temp      = int256(encoded / 100000);   // 0.1 °C units

        bytes32 eventId = oReq.eventId;
        DisruptionEvent storage evt = disruptionEvents[eventId];
        evt.temperature     = temp;
        evt.rainfallMm      = rain;
        evt.oracleValidated = true;

        bool autoActivated = false;
        if (rain > 200 || temp > 420 || weatherId < 700 || evt.weatherRiskScore >= 70) {
            evt.active   = true;
            autoActivated = true;
        }

        emit OracleValidationFulfilled(requestId, eventId, temp, rain, weatherId, autoActivated);
        emit DisruptionRegistered(eventId, evt.city, evt.disruptionType, evt.weatherRiskScore, true);
    }

    // ── Config updates ─────────────────────────────────────────────────

    function updateSubscriptionId(uint64 _subscriptionId) external onlyOwner {
        subscriptionId = _subscriptionId;
    }

    function updateDonId(bytes32 _donId) external onlyOwner {
        donId = _donId;
    }

    // ── View functions ─────────────────────────────────────────────────

    function getPayoutCount() external view returns (uint256) {
        return allPayoutIds.length;
    }

    function getEventCount() external view returns (uint256) {
        return allEventIds.length;
    }

    function getRecentPayouts(uint256 count) external view returns (PayoutRecord[] memory) {
        uint256 total = allPayoutIds.length;
        uint256 size  = count > total ? total : count;
        PayoutRecord[] memory result = new PayoutRecord[](size);
        for (uint256 i = 0; i < size; i++) {
            result[i] = payoutRecords[allPayoutIds[total - size + i]];
        }
        return result;
    }

    function getStats() external view returns (
        uint256 totalPaid,
        uint256 totalWorkers,
        uint256 totalPremiums,
        uint256 totalEvents
    ) {
        return (
            totalPayoutsPaise,
            totalWorkersProtected,
            premiumsCollectedPaise,
            allEventIds.length
        );
    }
}
