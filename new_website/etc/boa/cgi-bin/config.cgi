#!/bin/sh
# Config CGI - Returns current settings via riddleBoxCfg

echo "Access-Control-Allow-Origin: *"
echo "Access-Control-Allow-Methods: GET, POST, OPTIONS"
echo "Content-Type: application/json"
echo ""

# Query all settings via riddleBoxCfg (authoritative runtime values)
# Use -g flag to get individual settings

get_val() {
    val=$(riddleBoxCfg -g "$1" 2>/dev/null)
    if [ -z "$val" ] || [ "$val" = "null" ]; then
        echo "null"
    else
        echo "$val"
    fi
}

echo "{"
echo "\"MicType\":$(get_val MicType),"
echo "\"BtAudio\":$(get_val BtAudio),"
echo "\"BackgroundMode\":$(get_val BackgroundMode),"
echo "\"HudGPSSwitch\":$(get_val HudGPSSwitch),"
echo "\"UDiskPassThrough\":$(get_val UDiskPassThrough),"
echo "\"FastConnect\":$(get_val FastConnect),"
echo "\"ImprovedFluency\":$(get_val ImprovedFluency),"
echo "\"KnobMode\":$(get_val KnobMode),"
echo "\"MouseMode\":$(get_val MouseMode),"
echo "\"AdvancedFeatures\":$(get_val AdvancedFeatures),"
echo "\"CustomCarLogo\":$(get_val CustomCarLogo)"
echo "}"
