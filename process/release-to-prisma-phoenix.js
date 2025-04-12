runRelease = function(s, codebase){
    function release(s, codebase, retried){
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

            var threshold = 15 * 60000;
            var now = new Date();
            
            var secondInterval = 5;
                s.setTimerInterval(secondInterval);

            var debug = s.getPropertyValue("debug") == "Yes";
            var transfer = s.getPropertyValue("transfer") == "Yes";
            var count

            if(debug){
                s.log(-1, "Auto Transfer Enabled: " + transfer)
            }
            
            // Set some directories.
            var xmlRepository = new Dir("C:/Switch/Landing/CanonPrismaServer/queue_phoenix");

            // Find the CSV's
            var xmlFiles = xmlRepository.entryList("*.xml", Dir.Files, Dir.Name);
            
            for(var i=0; i<xmlFiles.length; i++){

                // Create the job to use in the flow.
                var filePath = xmlRepository.absPath + "/" + xmlFiles[i]
                var xmlFile = new File(filePath);
                var job = s.createNewJob(filePath);

                // Establish some data from the xml.
                var doc = new Document(xmlRepository.absPath + "/" + xmlFiles[i]);
                var map = doc.createDefaultMap();
                var layouts = doc.evalToNodes('//job/layouts/layout', map);
                var projectID = doc.evalToString('//job/id', map);
                var width = doc.evalToString('//job/products/product/width', map).replace('"','')/2;
                var height = doc.evalToString('//job/products/product/height', map).replace('"','');
                var form = width + 'x' + height

                // Pull the URL from the database.
                db.history.execute("SELECT * FROM history.details_gang WHERE `gang-number` = '" + projectID + "' order by ID desc;");

                // If the row doesn't exist, skip the job and send a notification.
                if(!db.history.isRowAvailable()){
                    job.setPrivateData("message","Undefined");
                    job.setPrivateData("status","undefined");
                    job.setPrivateData("error", "Gang not found in history database.");
                    job.setPrivateData("channel","Prisma Updates");
                    job.setUserEmail("Unknown")
                    job.sendTo(findConnectionByName_db(s, "Webhook"), filePath);
                    continue;
                }

                // Fetch the row.
                db.history.fetchRow();

                // Add the user to the job.
                job.setUserEmail(db.history.getString(12));

                // Establish some variables to populate.
                var signatures = []
                var cover, coverCommand, signatureCommand
                var stock = {
                    signature: null,
                    cover: null
                }

                // Assign some values from the database.
                var virtualPrinter = db.history.getString(25);
                var dueDate = db.history.getString(6);
                var separateCover = {
                    enabled: db.history.getString(26) == 'y',
                    value: db.history.getString(27)
                }

                // Target the files in the correct repository.
                //var pdfRepository = new Dir("C:/Switch/Landing/CanonPrismaServer/repository/" + projectID);
                var dir = {
                    print: new Dir("//amz-impsw-data/IMPSW_DATA/Backup/" + projectID + "/Print/"),
                    summary: new Dir("//amz-impsw-data/IMPSW_DATA/Backup/" + projectID + "/Summary/")
                }

                var pdfFiles = dir.print.entryList("*.pdf", Dir.Files, Dir.Name);

                // Sort the files in the correct order.
                pdfFiles.sort(function(a, b) {
                    var numA = parseInt(a.split("-")[1].split("_")[0], 10);
                    var numB = parseInt(b.split("-")[1].split("_")[0], 10);
                    return numA - numB;
                });

                // If all of the files are in the repository, compile and send to Prisma.
                if(pdfFiles.length == layouts.length){

                    // Assemple some data.
                    count = doc.evalToString('//job/layouts/layout/run-length', map);
                    height = 0;

                    // Add the height onto the stock name.
                    stock.cover = separateCover.value + "_80m"
                    stock.signature = virtualPrinter + "_80m"

                    // Set the max quantity allowed on the Canon.
                    if(count > 32767){
                        count = 32767
                    }

                    // Create the VM template file for the signature page.
                    var octFile = new File(dir.summary.path + "/" + stock.signature + ".oct");
                    if(octFile.exists){
                        octFile.remove()
                    }
                        octFile.open(File.Append);
                        octFile.writeLine('[job]')
                        octFile.writeLine('Printer_Setup_Name=' + stock.signature)
                        octFile.write('Due_Date=' + dueDate + 'T00:00:00-06:00')
                        octFile.close();

                    // Create the VM template file for the cover page.
                    if(separateCover.enabled){
                        var octFile = new File(dir.summary.path + "/" + stock.cover + ".oct");
                        if(octFile.exists){
                            octFile.remove()
                        }
                            octFile.open(File.Append);
                            octFile.writeLine('[job]')
                            octFile.writeLine('Printer_Setup_Name=' + stock.cover)
                            octFile.write('Due_Date=' + dueDate + 'T00:00:00-06:00')
                            octFile.close();
                    }

                    // Add the full path to the file names.
                    for(var i=0; i<pdfFiles.length; i++){
                        if(separateCover.enabled){
                            if(i==0){
                                cover = dir.print.path + "/" + pdfFiles[i];
                            }else{
                                signatures.push(dir.print.path + "/" + pdfFiles[i]);
                            }
                        }else{
                            signatures.push(dir.print.path + "/" + pdfFiles[i]);
                        }
                    }

                    var test = ""
                    if(debug){
                        test = "-test"
                    }

                    // Create the cmd line for the signature pages.
                    signatureCommand = 'C:/Scripts/prod/canon-prostream/support/spjm -s spjmUser@10.2.32.220 -user service -pwd service -t C:/Scripts/prod/canon-prostream/boilerplate/Duplex-Template.tic -oct ' + dir.summary.path + '/' + stock.signature + '.oct -jn ' + projectID + test + ' -form ' + form + ' -nc ' + count + ' -f ' + signatures.toString().replace(/,/g,' ');

                    // Create the cmd line for the cover page.
                    if(separateCover.enabled){
                        coverCommand = 'C:/Scripts/prod/canon-prostream/support/spjm -s spjmUser@10.2.32.220 -user service -pwd service -t C:/Scripts/prod/canon-prostream/boilerplate/Duplex-Template.tic -oct ' + dir.summary.path + '/' + stock.cover + '.oct -jn ' + projectID + test + '-cover' + ' -form ' + form + ' -nc ' + count + ' -f ' + cover.toString().replace(/,/g,' ');
                    }

                    // Write bat file.
                    var batFile = new File(dir.summary.path + "/initiate-transfer.bat");
                    if(batFile.exists){
                        batFile.remove()
                    }
                        batFile.open(File.Append);
                        batFile.writeLine(signatureCommand);
                        if(separateCover.enabled){
                            batFile.writeLine(coverCommand);
                        }
                        batFile.close();

                    // Automatically execute the command.
                    if(transfer){
                        Process.execute(dir.summary.path + "/initiate-transfer.bat")
                        if(Process.stderr == ""){
                            job.setPrivateData("message","Transferred Successfully");
                            job.setPrivateData("status","complete");
                            job.setPrivateData("error", "None");
                            job.setPrivateData("channel","Prisma Done");
                        }else{
                            job.setPrivateData("message","Transfer Failed");
                            job.setPrivateData("status","failed");
                            job.setPrivateData("error", Process.stderr);
                            job.setPrivateData("channel","Prisma Fail")
                        }
                        job.sendTo(findConnectionByName_db(s, "Webhook"), filePath);
                    }
                }else{

                    // Check if enough time has passed to move the file from the queue.
                    var modified = new Date(xmlFile.lastModified);
                    if(now.getTime() - modified.getTime() > threshold){
                        job.setPrivateData("message","Threshold");
                        job.setPrivateData("status","threshold");
                        job.setPrivateData("error", "Missing layouts and time threshold has been met, moving out of queue.");
                        job.setPrivateData("channel","Prisma Updates");
                        job.sendTo(findConnectionByName_db(s, "Webhook"), filePath);
                        continue;
                    }
                }
            }
                
        }catch(e){
            if(!retried){
                s.log(2, "Retrying...")
                parser(s, job, codebase, true)
            }
            s.log(2, "Critical Error!: " + e);
        }
    }
    release(s, codebase, false)
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