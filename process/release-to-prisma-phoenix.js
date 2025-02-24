runRelease = function(s, codebase){
    function release(s, codebase){
        try{
            //var dir = {
            //    support: "C:/Scripts/" + codebase + "/switch/process/support/"
            //}

            // Read in any support directories
            //eval(File.read(dir.support + "/general-functions.js"));
            //eval(File.read(dir.support + "/connect-to-db.js"));
            //eval(File.read(dir.support + "/load-module-settings.js"));
            //eval(File.read(dir.support + "/get-column-index.js"));
            //eval(File.read(dir.support + "/sql-statements.js"));

            // Load settings from the module
            //var module = loadModuleSettings(s)

            // Establist connection to the databases
            /*
            var connections = establishDatabases(s, module)
            var db = {
                settings: new Statement(connections.settings),
                history: new Statement(connections.history),
                email: new Statement(connections.email)
            }
                */
            
            var secondInterval = 5;
                s.setTimerInterval(secondInterval);

            var debug = s.getPropertyValue("debug") == "Yes";
            var transfer = s.getPropertyValue("transfer") == "Yes";
            var now = new Date();
            var count, stock

            if(debug){
                s.log(-1, "Auto Transfer Enabled: " + transfer)
            }
            
            // Set the threshold that the system waits
            var threshold = 15 * 60000;
            
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
                var dueDate = "2025-02-20" //doc.evalToString('//*[local-name()="Product"]/@DueDate', map);

                // Create the job to use in the flow.
                var filePath = xmlRepository.absPath + "/" + xmlFiles[i]
                var newCSV = s.createNewJob(filePath);

                // Target the files in the correct repository.
                var pdfRepository = new Dir("C:/Switch/Landing/CanonPrismaServer/repository/" + projectID);
                var pdfFiles = pdfRepository.entryList("*.pdf", Dir.Files, Dir.Name);

                var send = false;

                // If all of the files are in the repository, compile and send to Prisma.
                if(pdfFiles.length == layouts.length){

                    // Pull some data from the Metrix xml.
                    stock = doc.evalToString('//job/layouts/layout/surfaces/surface/stock/name', map);
                    count = doc.evalToString('//job/run-length', map);
                    height = 0;

                    stockSheet = doc.evalToString('//job/layouts/layout/surfaces/surface/sheet/height', map);

                    //if(stock == "80-lb-Paper-Gloss"){
                        stock = "80PG";
                        send = true;
                    //}

                    if(stock == "80-lb-Paper-Matte"){
                        stock = "80PM";
                        send = true;
                    }

                    if(stock == "100-lb-Paper-Gloss"){
                        stock = "100PG"
                        send = true;
                    }

                    if(stock == "100-lb-Paper-Matte"){
                        stock = "100PM"
                        send = true;
                    }

                    if(!send){
                            newCSV.setPrivateData("message","Undefined Stock");
                            newCSV.setPrivateData("status","undefined");
                            newCSV.sendTo(findConnectionByName_db(s, "Webhook"), filePath);
                        continue;
                    }

                    //stock = stock + "_" + height
                    stock = stock + "_80PG"

                    // Create the VM template file
                    var octFile = new File(pdfRepository.path + "/" + stock + ".oct");
                    if(octFile.exists){
                        octFile.remove()
                    }
                        octFile.open(File.Append);
                        octFile.writeLine('[job]')
                        octFile.writeLine('Printer_Setup_Name=' + stock)
                        octFile.write('Due_Date=' + dueDate + 'T00:00:00-06:00')
                        octFile.close();

                    // Add the full path to the file names.
                    for (var i = 0; i < pdfFiles.length; i++) {
                        pdfFiles[i] = "C:/Switch/Landing/CanonPrismaServer/repository/" + projectID + "/" + pdfFiles[i];
                    }

                    // Create the cmd line.
                    var command = 'C:/Scripts/prod/canon-prostream/support/spjm -s spjmUser@10.2.32.220 -user service -pwd service -t C:/Scripts/prod/canon-prostream/boilerplate/Duplex-Template.tic -oct C:/Switch/Landing/CanonPrismaServer/repository/' + projectID + '/' + stock + '.oct -jn ' + projectID + ' -nc ' + count + ' -f ' + pdfFiles.reverse().toString().replace(/,/g,' ');
                    //var movexml = 'robocopy "C:/Switch/Landing/CanonPrismaServer/queue/" "C:/Switch/Landing/CanonPrismaServer/complete/" ' + projectID + '.xml /mov /s'

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
                        //batFile.write(movexml)
                        batFile.close()

                    // Automatically execute the command.
                    if(transfer){
                        Process.execute("C:\\Switch\\Landing\\CanonPrismaServer\\repository\\" + projectID + "\\initiate-transfer.bat")
                        if(Process.stderr == ""){
                            newCSV.setPrivateData("message","Transferred Successfully");
                            newCSV.setPrivateData("status","complete");
                        }else{
                            newCSV.setPrivateData("message","Transfer Failed");
                            newCSV.setPrivateData("status","failed");
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