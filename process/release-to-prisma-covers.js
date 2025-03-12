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
            var count
            var stock = {}

            if(debug){
                s.log(-1, "Auto Transfer Enabled: " + transfer)
            }
            
            // Set the threshold that the system waits
            var threshold = 15 * 60000;
            
            // Set some directories.
            var mxmlRepository = new Dir("C:/Switch/Landing/CanonPrismaServer/queue");

            // Find the CSV's
            var mxmlFiles = mxmlRepository.entryList("*.mxml", Dir.Files, Dir.Name);
            
            for(var i=0; i<mxmlFiles.length; i++){

                // Read in the Metrix mxml.
                var doc = new Document(mxmlRepository.absPath + "/" + mxmlFiles[i]);
                var map = doc.createDefaultMap();
                var layouts = doc.evalToNodes('//*[local-name()="Layout"]', map);
                var projectID = doc.evalToString('//*[local-name()="Project"]/@ProjectID', map);
                var dueDate = doc.evalToString('//*[local-name()="Product"]/@DueDate', map);

                // Create the job to use in the flow.
                var filePath = mxmlRepository.absPath + "/" + mxmlFiles[i]
                var newCSV = s.createNewJob(filePath);

                // Target the files in the correct repository.
                var pdfRepository = new Dir("C:/Switch/Landing/CanonPrismaServer/repository/" + projectID);
                var pdfFiles = pdfRepository.entryList("*.pdf", Dir.Files, Dir.Name);
                var signatures = []
                var cover

                var send = false;

                // If all of the files are in the repository, compile and send to Prisma.
                if(pdfFiles.length == layouts.length){

                    // Pull some data from the Metrix mxml.
                    //stock = doc.evalToString('//*[local-name()="Stock"]/@Name', map).replace(/\./g,'').replace(/ /g,'-');
                    //stock = doc.evalToNodes('//*[local-name()="Stock"]', map);

                    count = doc.evalToString('//*[local-name()="Layout"]/@SheetsRequired', map);
                    height = 0;

                    // Pull the stockSheet nodes up to loop through.
                    stockSheet = doc.evalToNodes('//*[local-name()="StockSheet"]', map);

                    // Loop through the nodes to find the width.
                    for(var ii=0; ii<stockSheet.length; ii++){
                        var node = stockSheet.getItem(ii);
                        if(node.getAttributeValue('Width') > height){
                            height = node.getAttributeValue('Width')
                        }
                    }

                    // Run the getStock function to find the stock.
                    stock = getStock(s, doc, map)

                    // If the stock wasn't found, send a team message.
                    if(!stock.cover.found || !stock.signature.found){
                        newCSV.setPrivateData("message","Undefined Stock");
                        newCSV.setPrivateData("status","undefined");
                        newCSV.sendTo(findConnectionByName_db(s, "Webhook"), filePath);
                        continue;
                    }

                    // Add the height onto the stock name.
                    stock.cover.name = stock.cover.name + "_80m"
                    stock.signature.name = stock.signature.name + "_80m"
                    
                    // Create the VM template file
                    var octFile = new File(pdfRepository.path + "/" + stock.cover.name + ".oct");
                    if(octFile.exists){
                        octFile.remove()
                    }
                        octFile.open(File.Append);
                        octFile.writeLine('[job]')
                        octFile.writeLine('Printer_Setup_Name=' + stock.cover.name)
                        octFile.write('Due_Date=' + dueDate + 'T00:00:00-06:00')
                        octFile.close();

                    // Create the VM template file
                    var octFile = new File(pdfRepository.path + "/" + stock.signature.name + ".oct");
                    if(octFile.exists){
                        octFile.remove()
                    }
                        octFile.open(File.Append);
                        octFile.writeLine('[job]')
                        octFile.writeLine('Printer_Setup_Name=' + stock.signature.name)
                        octFile.write('Due_Date=' + dueDate + 'T00:00:00-06:00')
                        octFile.close();

                    // Add the full path to the file names.
                    for (var i = 0; i < pdfFiles.length; i++){
                        if(i==pdfFiles.length-1){
                            cover = "C:/Switch/Landing/CanonPrismaServer/repository/" + projectID + "/" + pdfFiles[i];
                        }else{
                            signatures.push("C:/Switch/Landing/CanonPrismaServer/repository/" + projectID + "/" + pdfFiles[i]);
                        }
                    }

                    // Create the cmd line.
                    var commandCover = 'C:/Scripts/prod/canon-prostream/support/spjm -s spjmUser@10.2.32.220 -user service -pwd service -t C:/Scripts/prod/canon-prostream/boilerplate/Duplex-Template.tic -oct C:/Switch/Landing/CanonPrismaServer/repository/' + projectID + '/' + stock.cover.name + '.oct -jn ' + projectID + '-cover' + ' -nc ' + count + ' -f ' + cover.replace(/,/g,' ');
                    var commandSignature = 'C:/Scripts/prod/canon-prostream/support/spjm -s spjmUser@10.2.32.220 -user service -pwd service -t C:/Scripts/prod/canon-prostream/boilerplate/Duplex-Template.tic -oct C:/Switch/Landing/CanonPrismaServer/repository/' + projectID + '/' + stock.signature.name + '.oct -jn ' + projectID + ' -nc ' + count + ' -f ' + signatures.reverse().toString().replace(/,/g,' ');

                    if(debug){
                        s.log(-1, commandSignature)
                        s.log(-1, commandCover)
                    }

                    // Write bat file.
                    var batFile = new File(pdfRepository.path + "/initiate-transfer.bat");
                    if(batFile.exists){
                        batFile.remove()
                    }
                        batFile.open(File.Append);
                        batFile.writeLine(commandSignature)
                        batFile.writeLine(commandCover)
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

function getStock(s, doc, map){

    // Create the object to hold the data.
    var stock = {
        nodes: doc.evalToNodes('//*[local-name()="Stock"]', map),
        signature:{
            found: false,
            name: null
        },
        cover:{
            found: false,
            name: null
        }
    }

    // Loop through all of the stock nodes to look for matches.
    for(var ii=0; ii<stock.nodes.length; ii++){
        
        var node = stock.nodes.getItem(ii).getAttributeValue('Name').replace(/\./g,'').replace(/ /g,'-');
        
        if(node == "80-lb-Paper-Gloss"){
            stock.signature.found = true;
            stock.signature.name = "80PG";
        }
    
        if(node == "80-lb-Paper-Matte"){
            stock.signature.found = true;
            stock.signature.name = "80PM";
        }
    
        if(node == "100-lb-Paper-Gloss"){
            stock.signature.found = true;
            stock.signature.name = "100PG";
        }
    
        if(node == "100-lb-Paper-Matte"){
            stock.signature.found = true;
            stock.signature.name = "100PM";
        }

        if(node == "10-pt-Cardstock-Gloss"){
            stock.cover.found = true;
            stock.cover.name = "10G";
        }
    }

    return stock
}