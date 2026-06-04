// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {FlowLink} from "../contracts/FlowLink.sol";

contract DeployFlowLink is Script {
    function run() external returns (FlowLink flowLink) {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(privateKey);
        flowLink = new FlowLink();
        vm.stopBroadcast();

        console2.log("FlowLink deployed to:", address(flowLink));
    }
}
