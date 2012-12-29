/*
*  Wrapper for the Sky+ box SOAP interface 
*/

var http = require('http');
var url  = require('url');
/* get channels from http://tv.sky.com/channel/index (default) OR use the guide @ http://tv.sky.com/tv-guide
 * and grab from the AJAX request made to  http://tv.sky.com/channel/index/<Your area>
 */
var channels = require('./channels.json').init.channels;

// Sky box
var skyServiceHost = process.argv[2];
if(!skyServiceHost){
	console.log('Usage: node skyplus.js <sky box IP> <local port>')
	process.exit();
}
var skyServicePort = 49153;

var localPort = process.argv[3] || 5555;
var requestCount = 0;

/*
 * 	SOAP Requests
 */

// SkyPlay2 Service
var playServicePath = '/SkyPlay2'
var pauseActions = {
	header : '"urn:schemas-nds-com:service:SkyPlay:2#Pause"',
	body : '<?xml version="1.0" encoding="utf-8"?>' +
			 '<s:Envelope s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/" xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>' +
			 '<u:Pause xmlns:u="urn:schemas-nds-com:service:SkyPlay:2">'+
			 '<InstanceID>0</InstanceID></u:Pause></s:Body></s:Envelope>',
	getBody : function(){
		return this.body;
	}
};	

var playActions = {
	header : '"urn:schemas-nds-com:service:SkyPlay:2#Play"',
	body : '<?xml version="1.0" encoding="utf-8"?>' +
			 '<s:Envelope s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/" xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>' +
			 '<u:Play xmlns:u="urn:schemas-nds-com:service:SkyPlay:2">'+
			 '<InstanceID>0</InstanceID><Speed>1</Speed></u:Play></s:Body></s:Envelope>',
	getBody : function(){
		return this.body;
	}
};

var channelActions = {
	header : '"urn:schemas-nds-com:service:SkyPlay:2#SetAVTransportURI"',
	getBody : function(channel){
		return '<?xml version="1.0" encoding="utf-8"?>' +
			 '<s:Envelope s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/" xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>' +
			 '<u:SetAVTransportURI xmlns:u="urn:schemas-nds-com:service:SkyPlay:2">'+
			 '<InstanceID>0</InstanceID><CurrentURI>xsi://'+channel+'</CurrentURI></u:SetAVTransportURI></s:Body></s:Envelope>'
	}
}

function doSkyRequest(actions, servicePath, initRes, actionArgs){

	var options = {
	  hostname: skyServiceHost,
	  port: skyServicePort,
	  path: servicePath,
	  method: 'POST',
     headers : {
	     'USER-AGENT':'SKY_skyplus',
	     'SOAPACTION' : actions.header,
	     'CONTENT-TYPE':'text/xml; charset="utf-8"'
      }
	};
	
	var req = http.request(options, function(res) {
	  res.setEncoding('utf8');
	  res.on('data', function (chunk) {
	    initRes.end(chunk);
	  });
	});
	
	req.write(actions.getBody(actionArgs));
	req.end();

	req.on('error', function(e) {
	  log('Error in Comms with SKY Box ' + e.message);
	});	
};

/*
 * 	Incoming HTTP Server
 */

http.createServer(function (req, res) {
	
	requestCount++;
	log('Total Requests: ' + requestCount);
	
	//ignore favicon requests
	if (req.url === '/favicon.ico') {
	    return;
	}
	
	var requestPath = url.parse(req.url).pathname;
	
   switch (requestPath){
   	case '/' : 
   		doGUIRequest(res);
   		break;
	  	case '/pause' :
	  		doSkyRequest(pauseActions,playServicePath,res);
	  		break;
	  	case '/play' :
	  		doSkyRequest(playActions,playServicePath,res);
	  		break;
	  	case '/channel' :
	  		var channel = url.parse(req.url, true).query.channel;
	  		doSkyRequest(channelActions,playServicePath,res,Number(channel).toString(16));
	  		break;
	  	default :
	  		res.end('Bad Request');
	  		break;
  	}
}).listen(localPort);
console.log("Server running on port "+ localPort)

// Simple Web GUI
function getJavaScript(){
	return '<head><script>' +
			 'function play(){var req = new XMLHttpRequest(); req.open("GET","/play"); req.send()}' +
			 'function pause(){var req = new XMLHttpRequest(); req.open("GET","/pause"); req.send()}' +
			 'function channel(num){var req = new XMLHttpRequest(); req.open("GET","/channel?channel="+num); req.send()}' +
			 '</script></head>'
}

function doGUIRequest(initRes){
	initRes.writeHead(200, { 'Content-Type': 'text/html'});
	initRes.write(getJavaScript());
	initRes.write('<h3> Sky+HD Web Remote Beta </h3>');
	initRes.write('<h5>Controlling Box at '+skyServiceHost+'</h5>');
	initRes.write('<h5>Controls</h5>');
	initRes.write('<button type="button" onclick="play()">Play</button>');
	initRes.write('<button type="button" onclick="pause()">Pause</button><br>');
	initRes.write('<h5>Channels</h5>');
	initRes.write(getChannelTable());
	initRes.end();
};
 
function getChannelTable(){
	var table = '';
	table += "<table border='1' cellpadding='4'>";
   table += "<tr><th>Channel</th><th>Name</th></tr>"; 
   
	for (var i=0; i < channels.length; i++) {
		var channel = channels[i];
		table += '<tr><td>' + channel.c[1] +'</td><td>'+ channel.t + '</td><td><button type="button" onclick="channel('+channel.c[0]+')">Change</button></td></tr>';
	}
	return table += "</table>";  
};

// Utils
var debug = false;
function log(message){
	if(debug){
		console.log(message)
	}
}