#!/usr/bin/env bash
set -euo pipefail

: "${SAMEWINDOW_DISPLAY:=:99}"
export DISPLAY="$SAMEWINDOW_DISPLAY"

exec /usr/bin/openbox --sm-disable
