const fs = require('fs');
const request = require('request');
const moment = require('moment');
const { exec } = require('child_process');

const rssFeed = 'https://nyaa.si/?page=rss'
const matchTime = 22; //time in minutes, the time since the show was posted and when it should be concidered too old.
const refresh = 10; //time in minutes, the time between checking cycles

var loadedShows;
var rss;
var rssShows = [];
var logName;

createLog(); //create log file

runCheck(); //run the first check on startup

setInterval(runCheck, refresh*60*1000); //run a new check every new refresh time

async function runCheck(){
    await getRSS();
    if(rss != null){ //if the rss feed is not there don't execute the other functions
        await getShows();
        await getMagnetlink();
    }    
    console.log(getTimeStamp() + ".");
}

//function to create a log file.
function createLog(){
    var a = "log_" + moment().format('YYMMDD-HHmm') + ".txt";
    logName = a;
    fs.writeFile(a,"Starting Log:\n",(err)=>{
        if(err) throw(err);        
    });
}

function getRSS(){
    return new Promise((resolve,reject) => {
        rss = null;
        request(rssFeed, function (error, response, body) {
            if(error){
                console.log("Error: ", error);
                console.log('statusCode:', response && response.statusCode);
                console.log("Internet connection or website is down. Retrying in 1 minute.")
                resolve();
            }
            else
            {                
                //break down into items and filter for english translated anime
                rss = body.split("<item>");
                rss.shift();
                for(var i =0; i < rss.length; i++){
                    if(rss[i].indexOf("<nyaa:categoryId>1_2</nyaa:categoryId>") == -1){
                        //not an english subbed anime
                        rss[i] = null;
                    }
                }
                rss.clean(null); //clean up the array and remove null entries
            
                //pull title and guid and store in 2d array
                var regTitle = /<title>(.*?)<\/title>/; //find title
                var regURL = /<guid isPermaLink="true">(.*?)<\/guid>/; //find permalink
                var regTime = /<pubDate>(.*?)<\/pubDate>/; //find date published
            
                //get title, permalink and publishing time and store in a 2d array
                for(var i = 0; i < rss.length; i++){
                    var tTitle = regTitle.exec(rss[i]);
                    var tURL = regURL.exec(rss[i]);
                    var tTime = regTime.exec(rss[i]);
                    var tArr = [tTitle[1],tURL[1],tTime[1]];
                    rssShows.push([]);
                    rssShows[i] = tArr;
                }        
                resolve();
            }
        });     
        
    });
}
    

function getShows(){ //readout your items list and store the data
    return new Promise((resolve,reject) => {
        fs.readFile('items.txt','utf8',function(err,data){
            var arr = [];
            var dataArray = data.split(/\r?\n/);//split on newlines
            dataArray.shift();//remove the first description entry from the array
            for(var i=0; i<dataArray.length; i++){
                arr.push([]);
                arr[i] = dataArray[i].split(',');
            }
            loadedShows = arr;
            resolve();
        });
    });    
}

function getMagnetlink(){  //first cycle through all the shows in the feed
    return new Promise((resolve,reject) => {
        for(var i = 0; i < rss.length; i++){
            //cycle through all the shows in the memory to see if one matches
            for(var j = 0; j < loadedShows.length; j++){ 
                
                var lowercaseTitle = rssShows[i][0].toLowerCase(); //convert the title to lowercase for case insensitive checking possibility
    
                var matchTag = rssShows[i][0].indexOf(loadedShows[j][0]); //check for tag
                if(loadedShows[j][0] == "*"){
                    matchTag = 0; //tag is wildcard so is always found
                }
                var matchName = lowercaseTitle.indexOf(loadedShows[j][1].toLowerCase()); //check for name
    
                var matchQual = rssShows[i][0].indexOf(loadedShows[j][2]); //check for quality
                if(loadedShows[j][2] == "*"){
                    matchQual = 0; //quality is wildcard so is always found
                }
                var matchKeyword = lowercaseTitle.indexOf(loadedShows[j][3].toLowerCase()); // check for keyword
                if(loadedShows[j][3] == "*"){
                    matchKeyword = 0; //keyword is wildcard so is always found
                }
                
                //DEBUG: for more verbose output on decision making
                if(matchName > -1){
                    console.log("Found: " + rssShows[i][0] + " other parameters(tqk): " + matchTag + matchQual + matchKeyword);
                }



              if(matchTag > -1 && matchName > -1 && matchQual > -1 && matchKeyword > -1){
                  //var magnetlink;
                  //console.log("Found Show:",rssShows[i][0]); //indicate we have a hit
                  var name = rssShows[i][0];
                  //check the time of the episode
                  var newEpisode = episodeTimeValid(rssShows[i][2]);
                  if(newEpisode){
                      //extract magnetlink
                    request(rssShows[i][1], function (error, response, body) {
                        if(error){
                            console.log("Error: ", error);
                            console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
                        }
                          body = body.replace(/[\n\r]+/g, '');
                          body = body.trim();
                          //console.log(body);
                          var regTitle = /<h3 class="panel-title">(.*?)<\/h3>/;
                          var regMagnetlink = /"(magnet:\?xt=urn:btih:.*?)"/;
                          var magnetlink = regMagnetlink.exec(body);
                          var Title = regTitle.exec(body);
                          

                          //DEBUG: log entries and show in console
                          var magnetText = getTimeStamp() + " added " + Title[1].trim() + "'s magnet link to the downloader. \n " + magnetlink[1] + "\n";
                          console.log("added " + Title[1].trim() + "'s magnet link to the downloader");
                          
                          fs.appendFile(logName, magnetText ,function(err){
                            if (err) throw err;
                          });
                          //end of debugging code

                          addTransmissionMagnetlink(magnetlink[1]);
                          //parse magnetlink to whatever torrent service you're using. Parsing magnetlink[1] gives you only the magnetlink string.

                          resolve();
                      });
                  }
                  else{
                      console.log('Episode not time valid.');
                      resolve();
                      
                  }
              }
              else
              {
                  resolve();
              }
            }
        }
    });    
}

//see if episode is time valid for download
function episodeTimeValid(timeStamp){
    var t = moment(timeStamp);
    var tn = moment.utc();
    var d = tn.diff(t,"minutes");
    //console.log(d);
    if(d < matchTime){
        return true;
    }
    else{
        //console.log("show too old: " + d + " minutes")
        return false;
    }
}

//get timestamp in current timezone
function getTimeStamp(){
    var t = moment().format('Do MMM YYYY [|] HH:mm [|] ');
    return t;
}

//add the magnetlink to the transmission demon
function addTransmissionMagnetlink(magnet){
    exec(`echo transmission-remote -n 'user:password' -a '${magnet}'`, (err, stdout, stderr) => {
        if (err) {
          // node couldn't execute the command
          console.log(`Could not execute the commeand: ${err}`)
          return;
        }
      
        // the *entire* stdout and stderr (buffered)
        console.log(`stdout: ${stdout}`);
        console.log(`stderr: ${stderr}`);
      });
}

//clean values out of arrays
Array.prototype.clean = function(deleteValue) {
    for (var i = 0; i < this.length; i++) {
      if (this[i] == deleteValue) {         
        this.splice(i, 1);
        i--;
      }
    }
    return this;
  };
