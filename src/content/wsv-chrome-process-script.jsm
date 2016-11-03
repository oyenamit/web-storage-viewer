/* ***** BEGIN LICENSE BLOCK *****
 *
 * Copyright (C) 2016 Namit Bhalla (oyenamit@gmail.com)
 * This file is part of 'Web Storage Viewer' extension for the Firefox browser.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 * ***** END LICENSE BLOCK ***** */


/*global Components, Services                                 */
/*jshint strict: global, white: true, esversion: 6, moz: true */


"use strict";


Components.utils.import( "resource://gre/modules/Services.jsm" );


// ---------------------------------------------------------------------------------------------------------
// The module exports only one symbol. 
// It serves as a namespace for all public functions and variables.
// ---------------------------------------------------------------------------------------------------------
this.EXPORTED_SYMBOLS = [ "WebStorageViewerChromeProcessScript" ];
var WebStorageViewerChromeProcessScript = {};


// ---------------------------------------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------------------------------------
var FRAME_SCRIPT_PATH = "chrome://web-storage-viewer/content/wsv-frame-script.js";


// When this module is loaded, we load framescripts in active tabs and all future tabs.
Services.mm.loadFrameScript( FRAME_SCRIPT_PATH, true);

