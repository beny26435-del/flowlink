// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {FlowLinkV4} from "../contracts/FlowLinkV4.sol";

contract DeployFlowLinkV4 is Script {
    function run() external returns (FlowLinkV4 flowLink) {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(privateKey);
        flowLink = new FlowLinkV4();
        vm.stopBroadcast();

        console2.log("FlowLinkV4 deployed at:", address(flowLink));
    }
}
