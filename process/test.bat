robocopy "\\slc-stor-01.us.digitalroominc.com\Process_Development\Bret\Canon Automation\1" "\\slc-stor-01.us.digitalroominc.com\Process_Development\Bret\Canon Automation\2" /mov /s

ping slc-stor-01 -n 6 > nul
exit