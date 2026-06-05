// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {FlowLinkV3} from "../contracts/FlowLinkV3.sol";

contract DeployFlowLinkV3 is Script {
    function run() external returns (FlowLinkV3 flowLink) {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(privateKey);
        flowLink = new FlowLinkV3();
        vm.stopBroadcast();

        console2.log("FlowLinkV3 deployed at:", address(flowLink));
    }
}
