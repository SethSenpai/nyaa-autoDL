const express = require('express');
const app = express();
const bodyParser = require("body-parser");
const fs = require('fs');
const auth = require('express-basic-auth');

app.use(express.static('www'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(auth({
    users: {'user' : 'password'},
    challenge: true
}));


app.get('/' , function(req,res){
    console.log("connection from: " + req.ip );
    res.sendFile(__dirname + "/www/portal.html");
});

app.get('/data', function(req, res){
    fs.readFile('../items.txt', 'utf8', function(err, data){
        if(err){
            throw err;
        }
        res.send(data);
    });
    console.log("data request from: " + req.ip)
});

app.post('/del', function(req,res){
    fs.readFile('../items.txt','utf8',function(err,data){
        if(err){
            throw err;
        }
        var l = data.split('\n');
        l.splice(req.body.line,1);
        var nl = l.join('\n');

        fs.writeFile('../items.txt',nl, (err) =>{
            if (err) throw err;
            console.log('Deleted line: ' + req.body.line);
            res.jsonp({data: 'Deleted the entry!'});
        });

    });
});

app.post('/send', function(req, res){
    var data = req.body;
    console.log(data);
    var nl = "\n" + data.tag + "," + data.name + "," + data.qual + "," + data.key;
    fs.appendFile('../items.txt',nl,function(err){
        if (err) throw err;
        console.log("Saved new entry to disk!");
        res.jsonp({data: 'Data received at server!'});
    });
});

app.listen(9993, () => console.log('listening on port 9993'));