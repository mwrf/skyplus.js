/*
 *  Web client for the Sky+ box
 */

var http = require('http');
var url = require('url');
var dgram = require('dgram');

/* get channels from http://tv.sky.com/channel/index (default) OR use the guide @ http://tv.sky.com/tv-guide
 * and grab from the AJAX request made to  http://tv.sky.com/channel/index/<Your area>
 */
var channels = require('./channels.json').init.channels;

// Sky box
var skyServiceHost = "";
var skyServicePort = 49153;
var skyBoxDetected = false;

// HTTP server
var localPort = process.argv[2] || 5555;
var httpServerRunning = false;


/*
* 	SOAP Request definitions
*/

// SkyPlay2 Service
var playServicePath = '/SkyPlay2'
var pauseActions = {
	header : '"urn:schemas-nds-com:service:SkyPlay:2#Pause"',
	body : '<?xml version="1.0" encoding="utf-8"?>' + 
				'<s:Envelope s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/" xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>' + 
				'<u:Pause xmlns:u="urn:schemas-nds-com:service:SkyPlay:2">' + 
				'<InstanceID>0</InstanceID></u:Pause></s:Body></s:Envelope>',
	getBody : function() {
		return this.body;
	}
};

var playActions = {
	header : '"urn:schemas-nds-com:service:SkyPlay:2#Play"',
	body : '<?xml version="1.0" encoding="utf-8"?>' + 
				'<s:Envelope s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/" xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>' + 
				'<u:Play xmlns:u="urn:schemas-nds-com:service:SkyPlay:2">' + 
				'<InstanceID>0</InstanceID><Speed>1</Speed></u:Play></s:Body></s:Envelope>',
	getBody : function() {
		return this.body;
	}
};

var ffwActions = {
	header : '"urn:schemas-nds-com:service:SkyPlay:2#Play"',
	getBody : function(speed) {
		return '<?xml version="1.0" encoding="utf-8"?>' +
	'<s:Envelope s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/" xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>' +
	'<u:Play xmlns:u="urn:schemas-nds-com:service:SkyPlay:2">' +
	'<InstanceID>0</InstanceID><Speed>' + speed + '</Speed></u:Play></s:Body></s:Envelope>';
	}
};

var channelActions = {
	header : '"urn:schemas-nds-com:service:SkyPlay:2#SetAVTransportURI"',
	getBody : function(channel) {
		return '<?xml version="1.0" encoding="utf-8"?>' + 
					'<s:Envelope s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/" xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>' + 
					'<u:SetAVTransportURI xmlns:u="urn:schemas-nds-com:service:SkyPlay:2">' + 
					'<InstanceID>0</InstanceID><CurrentURI>xsi://' + channel + '</CurrentURI></u:SetAVTransportURI></s:Body></s:Envelope>'
	}
}

/*
 * 	Sends requests to the detected Sky Box
 */
function doSkyRequest(actions, servicePath, initRes, actionArgs) {

	var options = {
		hostname : skyServiceHost,
		port : skyServicePort,
		path : servicePath,
		method : 'POST',
		headers : {
			'USER-AGENT' : 'SKY_skyplus', // This seems to be required.
			'SOAPACTION' : actions.header,
			'CONTENT-TYPE' : 'text/xml; charset="utf-8"'
		}
	};

	var req = http.request(options, function(res) {
		res.setEncoding('utf8');
		res.on('data', function(chunk) {
			initRes.end(chunk);
		});
	});

	req.write(actions.getBody(actionArgs));
	req.end();

	req.on('error', function(e) {
		console.log('Error in Comms with SKY Box ' + e.message);
	});
};

/*
 * 	Incoming HTTP Server. Passes requests to
 */
function startHTTPServer() {

	http.createServer(function(req, res) {
		//ignore favicon requests
		if (req.url === '/favicon.ico') {
			return;
		}

		var requestPath = url.parse(req.url).pathname;

		switch (requestPath) {
			case '/' :
				doGUIRequest(res);
				break;
			case '/pause' :
				console.log("Pausing");
				doSkyRequest(pauseActions, playServicePath, res);
				break;
			case '/play' :
				console.log("Playing");
				doSkyRequest(playActions, playServicePath, res);
				break;
			case '/channel' :
				var channel = url.parse(req.url, true).query.channel;
				console.log("Changing to channel ID " + channel);
				doSkyRequest(channelActions, playServicePath, res, Number(channel).toString(16));
				break;
			case '/ffw' :
				var speed = url.parse(req.url, true).query.speed;
				console.log("Fast forwarding at " + speed + "x speed");
				doSkyRequest(ffwActions, playServicePath, res, Number(speed).toString(16));
				break;
			case '/skipAds' :
				var speed = url.parse(req.url, true).query.speed;
				console.log("Attempting to Skip adverts, playing in 7 seconds");
				doSkyRequest(ffwActions, playServicePath, res, 30);
				setTimout(function(){doSkyRequest(playActions, playServicePath, res)},7000);
				break;
			case '/scheduled' :
				var channel = url.parse(req.url, true).query.channel;
				console.log("Schedule called for channel: " + channel);
				getChannelListings(channel, function(data) {
					var current = getCurrentScheduledProgram(data);
					console.log('Current Program : ' + current);
					res.end(current);
				}); 
            break;
			default :
            
				console.log("Bad Request to " + requestPath);
				res.end('Bad Request');
				break;
		}
	}).listen(localPort);
	console.log("Web server now running on port " + localPort)
}

/*
 * 	Generates the HTML for the Web Client
 */
function doGUIRequest(initRes) {
	initRes.writeHead(200, {
		'Content-Type' : 'text/html'
	});
	initRes.write('<head>');
	initRes.write(getClientJavaScript());
	initRes.write('</head>');
	initRes.write('<h3> Sky+HD Web Remote Beta </h3>');
	initRes.write('<h5>Controlling Box at ' + skyServiceHost + '</h5>');
	initRes.write('<h5>Controls</h5>');
	initRes.write('<div id="nowplaying"></div>');
	initRes.write('<button type="button" onclick="play()">Play</button>');
	initRes.write('<button type="button" onclick="pause()">Pause</button><br>');
	initRes.write('<button type="button" onclick="skipAds()">Skip Ads</button><br>');
	initRes.write(getChannelTable());
	initRes.end();
};

/*
 * 	Returns a HTML table of the channel data
 */
function getChannelTable() {
	var table = '';
	table += '<div class="datagrid"><table border="1" cellpadding="4">';
	table += '<tr><th>Logo</th><th>Channel</th><th>Name</th><th>Action</th><th>Now Playing</th></tr>';

	for (var i = 0; i < channels.length; i++) {
		var channel = channels[i];
		table += '<tr><td> <img src="http://tv.sky.com/logo/80/35/skychb' + channel.c[0] + '.png"/> </td><td>' + channel.c[1] + '</td><td>' + channel.t + 
		'</td><td><button type="button" onclick="channel(' + channel.c[0] + ')">Change</button></td> '+
		'<td id="now' + channel.c[0] + '"><button type="button" onclick="now(' + channel.c[0] + ')">Query</button></td></tr>';
	}
	return table += '</table><div>';
};

/*  Returns the JS for the button actions on the web client */
function getClientJavaScript() {
	return 	'<script> \r\n'+
				'function now(num){var req = new XMLHttpRequest(); \r\n'+
					'req.onreadystatechange = function(){  \r\n'+
						'if(req.readyState == 4 && req.status==200){ console.log(req.responseText) \r\n'+
						'document.getElementById("now"+num).innerHTML = req.responseText}} \r\n ' +
					'req.open("GET","/scheduled?channel="+num,true); req.send();} \r\n ' +
				'function play(){var req = new XMLHttpRequest(); req.open("GET","/play"); req.send()}; \r\n ' + 
				'function pause(){var req = new XMLHttpRequest(); req.open("GET","/pause"); req.send()}; \r\n ' + 
				'function skipAds(){var req = new XMLHttpRequest(); req.open("GET","/skipAds"); req.send()}; \r\n ' + 
				'function channel(num){var req = new XMLHttpRequest(); req.open("GET","/channel?channel="+num); req.send()}; \r\n ' +
				'</script> \r\n '+
				'<script src="//ajax.googleapis.com/ajax/libs/jquery/1.8.2/jquery.min.js" type="text/javascript"></script> \r\n '
				'<script src="footable.js" type="text/javascript"></script> \r\n ' +
				'<script type="text/javascript"> \r\n ' +
				'$(function() { \r\n ' +
				'$(''table'').footable(); \r\n ' +
				'}); \r\n ' +
				'</script>';
};
//	'req.open("GET","/schedule?channel="+num,true); req.send();} ' +
/*	Listens to SSDP Broadcasts. */
function discoverSkyBox() {
	console.log("Detecting Sky Box on network, Please wait up to 30 seconds.......")
	var server = dgram.createSocket("udp4");

	server.on("message", function(msg, rinfo) {
	   console.log("Broadcast from "+rinfo.address);
		// User-Agent from Sky box is ALWAYS "redsonic". Use this to check if broadcast is from a Sky Box
		if (String(msg).indexOf("redsonic") > 1) {
			console.log("Sky Box detected at " + rinfo.address);
			skyServiceHost = rinfo.address;
			server.close();
			startHTTPServer();
		}
	});
	// SSDP Broadcasts to Port 1900
	server.bind(1900);
};

/* 1 to 01 etc.*/
function zeroPad(n){
   return n < 10 ? '0'+n : n;
}

/*
* Fetches the days listings from Sky servers for any channel
*/
function getChannelListings(channel,callback){
   
   var listingsCount = 0;
   var mergedListings = [];
   
   var now = new Date(),
      year = now.getFullYear(),
      month = zeroPad(now.getUTCMonth() + 1),
      date = zeroPad(now.getUTCDate()),
      fullDate = year +'-'+ month +'-'+ date;
   
   for (var i = 0; i < 4; i++){
      var options = {
        host: 'tv.sky.com',
        port: 80,
        path: '/programme/channel/' + channel +'/'+ fullDate + '/' + i + '.json'
      };

      var req = http.request(options, function(res) {
        res.setEncoding('utf8');
        var chunks = "";
        
        res.on('data', function (chunk) {
	        chunks = chunks + chunk;
        });
        
        res.on('end', function () {
        
          var parsed = JSON.parse(chunks);
          listingsCount ++;
          
          for (var key in parsed.listings) {
               if(key == channel){
                  var progs = parsed.listings[channel];
                  for(var j = 0; j < progs.length; j++) {
                     mergedListings.push(progs[j]);
                 }
               }
            }
            if(listingsCount == 4){
               console.log('Got Listings for channel '+ channel + ' No of programs: '+mergedListings.length )
               callback(mergedListings);
            }
        });
      });
      req.end();
   }
};

/* for sorting by time */
function compare(a,b) {
  if (a.s < b.s)
     return -1;
  if (a.s > b.s)
    return 1;
  return 0;
}

/*
*  returns the current scheduled program
*/
function getCurrentScheduledProgram(progs){
   var lastEntry;
   var now = Math.round(+new Date()/1000);
   progs.sort(compare);
   
   for (var i = 0; i < progs.length; i++){
      var entry = progs[i];
      if(entry.s < now){
         lastEntry = entry;
      }
        // if the program is in the future then we want the last program we iterated over
       if(entry.s > now){
         return lastEntry.t
      }
   }
};


/*
 * 	Start by looking for Sky boxes on the network
 */
discoverSkyBox();
startHTTPServer();
