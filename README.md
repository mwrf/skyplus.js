skyplus.js
==========

Web Client for controlling a Sky+HD Box

Supports Pause / Play and Channel changing.

Usage
------------
(a) Install node.js if you have not already

(b) Clone this repo OR copy skyplus.js and channels.json to some directory

(d) Navigate to the directory containing skyplus.js and channels.json and 

run "node skyplus.js <optional local port>"

A Sky box will be autodetected on your network if one exists. 

Browse to http://localhost:5555 in your browser!

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
