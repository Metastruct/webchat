#!/bin/bash
echo Updating...
git pull
echo Killing...

ps --no-headers  --format pid | tr -d ' ' | while read line;do
	if pwdx $line 2>/dev/null | fgrep -- "$PWD/daemon" >/dev/null; then
		echo KILLING EXISTING `cat "/proc/$line/cmdline" | tr '\000' ' '`
		kill $line
	fi
done

cd daemon || exit 1
echo Prereqs...
npm install

echo Launching...
nohup ./launch >/dev/null 2>/dev/null &

echo Uploading to FTP...
cd ../website || exit 1

read -p "Host: " FFTP
read -p "User: " FUSR
read -s -p "password: " FPW
echo FTPing...

BASE="./"

ftp -v -n $FFTP <<End-Of-Session
user "$FUSR" "$FPW"
binary
$(
for di in *;do
	if [ -d "$di" ]; then
		echo mkdir "$BASE/$di"
		for f in $di/*;do
			echo "put \"$f\" \"${BASE}$f\" "
		done
	else
		echo "put \"$di\" \"${BASE}$di\" "
	fi
done
)
bye
End-Of-Session
