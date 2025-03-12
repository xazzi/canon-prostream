runPost = function(s, job, codebase){
    function post(s, job, codebase){
        try{
            var dir = {
                support: "C:/Scripts/" + codebase + "/switch/process/support/"
            }

            // Read in any support directories
            eval(File.read(dir.support + "/general-functions.js"));
            eval(File.read(dir.support + "/connect-to-db.js"));
            eval(File.read(dir.support + "/load-module-settings.js"));

            var handoffDataDS = loadDatasetNoFail_db("Handoff Data");

            var newJob = s.createNewJob();
            var xmlfile = newJob.createPathWithName("Submit" + ".json", false);
            var xmlF = new File(xmlfile);

            // Load settings from the module
            var module = loadModuleSettings(s)

            // Establist connection to the databases
            var connections = establishDatabases(s, module)
            var db = {
                settings: new Statement(connections.settings),
                history: new Statement(connections.history),
                email: new Statement(connections.email)
            }

            // Pull the URL from the database.
            db.settings.execute("SELECT * FROM settings.webhooks_teams WHERE channel = '" + s.getPropertyValue("channel") + "';");
            if(!db.settings.isRowAvailable()){
                job.fail("Teams Channel Not Found!")
                return
            }

            db.settings.fetchRow();
            var url = db.settings.getString(2);

            var messageCard = {};
            var sections = [];
                messageCard.type = "MessageCard"
                messageCard.summary = s.getServerName();
                messageCard.sections = sections;

            // Create the array of items you want to post to the webhook.
            var query = [
                ["Gang", job.getNameProper()],
                ["User", "Unknown"],
                ["Error", job.getPrivateData("error")],
                ["Server", s.getServerName()]
            ]

            // Create the structure that we pass into the webhook
            var structure = {
                facts: []
            }

            // Loop through the queries, cleaning up any errors, and push the final answer to the attributes.
            for(var i=0; i<query.length; i++){
                var temp

                try{
                    temp = query[i][1]
                }catch(e){
                    temp = "Unknown"
                }

                var attributes = {
                    name:query[i][0],
                    value:temp
                }
                structure["facts"].push(attributes)
            }

            structure.activityTitle = s.getPropertyValue("message")
                    
            messageCard.sections.push(structure);

            xmlF.open(File.Append);
            xmlF.writeLine(JSON.stringify(messageCard));
            xmlF.close();
                
            // Post the above json to the API.
            var theHTTP = new HTTP(HTTP.SSL);
                theHTTP.url = url;
                theHTTP.enableMime = false;
                theHTTP.setAttachedFile(xmlfile);
                theHTTP.timeOut = 300;
                theHTTP.post();
                
            while(!theHTTP.waitForFinished(10)){
                s.log(5, "Posting to Teams...", theHTTP.progress());
            }
            
            if(theHTTP.finishedStatus == HTTP.Failed || theHTTP.statusCode !== 200){
                s.log(3, "Teams post failed: " + theHTTP.lastError);
                job.fail(e);
                return;
            }
                    
            job.sendToSingle(job.getPath()) 
            
        }catch(e){
            s.log(3, "Critical Error: Teams Message:" + e)
            job.fail(e);
        }
    }
    post(s, job, codebase)
}