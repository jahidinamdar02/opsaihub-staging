#!/bin/bash
DISK=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
MEM=$(free | grep Mem | awk '{printf "%.0f", $3/$2*100}')
SUB_SIZE=$(du -sk data/submissions.json | cut -f1)
RESTARTS=$(pm2 jlist 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[1]['pm2_env']['restart_time'] if len(d)>1 else 0)" 2>/dev/null || echo 0)

echo "$(date): DISK=${DISK}% MEM=${MEM}% SUBS=${SUB_SIZE}KB RESTARTS=${RESTARTS}" >> ~/health.log

if [ "$DISK" -gt 80 ]; then echo "ALERT: Disk at ${DISK}%" | mail -s "OpsAIHub Disk Alert" jahidinamdar02@gmail.com 2>/dev/null; fi
if [ "$MEM" -gt 85 ]; then echo "ALERT: Memory at ${MEM}%" | mail -s "OpsAIHub Memory Alert" jahidinamdar02@gmail.com 2>/dev/null; fi
if [ "$SUB_SIZE" -gt 50000 ]; then echo "ALERT: Submissions file ${SUB_SIZE}KB - consider database migration" | mail -s "OpsAIHub Data Alert" jahidinamdar02@gmail.com 2>/dev/null; fi
