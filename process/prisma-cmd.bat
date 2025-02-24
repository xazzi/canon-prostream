@echo off
:: Get current date and time in YYYY-MM-DD_HH-MM-SS format
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set now=%datetime:~0,4%-%datetime:~4,2%-%datetime:~6,2%_%datetime:~8,2%:%datetime:~10,2%:%datetime:~12,2%

:: Set count variable
set count=100

:: Run the command
..\spjm -s spjmUser@10.2.32.220 -user service -pwd service -t ./Duplex-Template.tic -oct ./100-gloss.oct -jn "JDT Test %now%" -nc %count% -f ./4110296-5_21448615.pdf ./4110296-4_21448615.pdf ./4110296-3_21448615.pdf ./4110296-2_21448615.pdf ./4110296-1_21448615.pdf

ping slc-stor-01 -n 6 > nul
exit