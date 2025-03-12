runRelease = function(s, codebase){
    function release(s, codebase){
        try{
            var dir = {
                support: "C:/Scripts/" + codebase + "/switch/process/support/"
            }

            // Read in any support directories
            eval(File.read(dir.support + "/general-functions.js"));
            eval(File.read(dir.support + "/connect-to-db.js"));
            eval(File.read(dir.support + "/load-module-settings.js"));

            // Load settings from the module
            var module = loadModuleSettings(s)

            // Establist connection to the databases
            var connections = establishDatabases(s, module)
            var db = {
                settings: new Statement(connections.settings),
                history: new Statement(connections.history),
                email: new Statement(connections.email)
            }
            
            var secondInterval = 5;
                s.setTimerInterval(secondInterval);

            var debug = s.getPropertyValue("debug") == "Yes";
            var transfer = s.getPropertyValue("transfer") == "Yes";
            var count, stock

            if(debug){
                s.log(-1, "Auto Transfer Enabled: " + transfer)
            }
            
            // Set some directories.
            var xmlRepository = new Dir("C:/Switch/Landing/CanonPrismaServer/queue_phoenix");

            // Find the CSV's
            var xmlFiles = xmlRepository.entryList("*.xml", Dir.Files, Dir.Name);
            
            for(var i=0; i<xmlFiles.length; i++){

                // Read in the Metrix xml.
                var doc = new Document(xmlRepository.absPath + "/" + xmlFiles[i]);
                var map = doc.createDefaultMap();
                var layouts = doc.evalToNodes('//job/layouts/layout', map);
                var projectID = doc.evalToString('//job/id', map);

                // Pull the URL from the database.
                db.history.execute("SELECT * FROM history.details_gang WHERE `gang-number` = '" + projectID + "' order by ID desc;");

                // If the row doesn't exist, skip the job and send a notification.
                if(!db.history.isRowAvailable()){
                    newCSV.setPrivateData("message","Undefined");
                    newCSV.setPrivateData("status","undefined");
                    newCSV.setPrivateData("error", "Gang not found in history database.");
                    newCSV.setPrivateData("channel","Prisma Updates");
                    newCSV.sendTo(findConnectionByName_db(s, "Webhook"), filePath);
                    continue;
                }

                // Pull the row data.
                db.history.fetchRow();

                // Assign some values from the database.
                var virtualPrinter = db.history.getString(25);
                var dueDate = db.history.getString(6);

                // Create the job to use in the flow.
                var filePath = xmlRepository.absPath + "/" + xmlFiles[i]
                var newCSV = s.createNewJob(filePath);
                    newCSV.setUserEmail(db.history.getString(12));

                // Target the files in the correct repository.
                var pdfRepository = new Dir("C:/Switch/Landing/CanonPrismaServer/repository/" + projectID);
                var pdfFiles = pdfRepository.entryList("*.pdf", Dir.Files, Dir.Name);

                var send = false;

                // If all of the files are in the repository, compile and send to Prisma.
                if(pdfFiles.length == layouts.length){

                    // Assemple some data.
                    count = doc.evalToString('//job/run-length', map);
                    height = 0;
                    stock = virtualPrinter + "_80m"

                    // Create the VM template file
                    var octFile = new File(pdfRepository.path + "/" + stock + ".oct");
                    if(octFile.exists){
                        octFile.remove()
                    }
                        octFile.open(File.Append);
                        octFile.writeLine('[job]')
                        octFile.writeLine('Printer_Setup_Name=' + stock)
                        octFile.writeLine('Message=yes')
                        octFile.writeLine('Message_Text=Test-For-Hamik')
                        octFile.write('Due_Date=' + dueDate + 'T00:00:00-06:00')
                        octFile.close();

                    // Add the full path to the file names.
                    for (var i = 0; i < pdfFiles.length; i++) {
                        pdfFiles[i] = "C:/Switch/Landing/CanonPrismaServer/repository/" + projectID + "/" + pdfFiles[i];
                    }

                    // Create the cmd line.
                    var command = 'C:/Scripts/prod/canon-prostream/support/spjm -s spjmUser@10.2.32.220 -user service -pwd service -t C:/Scripts/prod/canon-prostream/boilerplate/Duplex-Template.tic -oct C:/Switch/Landing/CanonPrismaServer/repository/' + projectID + '/' + stock + '.oct -jn ' + projectID + ' -nc ' + count + ' -f ' + pdfFiles.toString().replace(/,/g,' ');

                    if(debug){
                        s.log(-1, command)
                    }

                    // Write bat file.
                    var batFile = new File(pdfRepository.path + "/initiate-transfer.bat");
                    if(batFile.exists){
                        batFile.remove()
                    }
                        batFile.open(File.Append);
                        batFile.writeLine(command)
                        batFile.close()

                    // Automatically execute the command.
                    if(transfer){
                        Process.execute("C:\\Switch\\Landing\\CanonPrismaServer\\repository\\" + projectID + "\\initiate-transfer.bat")
                        if(Process.stderr == ""){
                            newCSV.setPrivateData("message","Transferred Successfully");
                            newCSV.setPrivateData("status","complete");
                            newCSV.setPrivateData("error", "None");
                            newCSV.setPrivateData("channel","Prisma Done");
                        }else{
                            newCSV.setPrivateData("message","Transfer Failed");
                            newCSV.setPrivateData("status","failed");
                            newCSV.setPrivateData("error", Process.stderr);
                            newCSV.setPrivateData("channel","Prisma Fail")
                        }
                        newCSV.sendTo(findConnectionByName_db(s, "Webhook"), filePath);
                    }
                }else{
                    s.log(2, "Missing layouts: " + projectID)
                }
            }
                
        }catch(e){
            s.log(2, "Critical Error!: " + e);
        }
    }
    release(s, codebase)
}

// Copied from the main support functions file.
findConnectionByName_db = function(s, inName){
	function findConnection(s, inName){
		var outConnectionList = s.getOutConnections();
		for(var i=0; i<outConnectionList.length; i++){
			var theConnection = outConnectionList.getItem(i);
			var theName = theConnection.getName();
            s.log(2, inName + " : " + theName)
			if(inName == theName){
				return theConnection;
			}
		}
		return null;
	}
	return contents = findConnection(s, inName)
}