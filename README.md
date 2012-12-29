skyplus.js
==========

Web Server / Services for controlling a Sky+HD Box

Supports Pause / Play and Channel changing.

Usage
------------
(a) Install node.js if you have not already

(b) Clone this repo OR copy skyplus.js and channels.json to some directory

(c) Find the IP address of your Sky+HD box (Services > Settings > Network)

(d) Navigate to the directory containing skyplus.js and channels.js and run "node skyplus <Sky Box IP> <Local Port>

Browse to http://localhost:<localPort> in your browser!

Channel list 
------------
Included is the channel list for Irish viewers, should you be in a different Sky region, 
Get channels from http://tv.sky.com/channel/index (default) OR use the guide @ http://tv.sky.com/tv-guide
and grab from the AJAX request made to http://tv.sky.com/channel/index/<Your area>

TODO
------------
Nicer Web interface

Enable TV Guide

Enable viewing and editing of Planner
