// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {FlowLinkV2} from "../contracts/FlowLinkV2.sol";

contract DeployFlowLinkV2 is Script {
    function run() external returns (FlowLinkV2 flowLink) {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(privateKey);
        flowLink = new FlowLinkV2();
        vm.stopBroadcast();

        console2.log("FlowLinkV2 deployed at:", address(flowLink));
    }
}
