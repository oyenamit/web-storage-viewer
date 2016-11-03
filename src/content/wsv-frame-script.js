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


/*global content, addMessageListener, addEventListener, removeEventListener, removeMessageListener */
/*jshint strict: global, white: true, esversion: 6, moz: true                                      */


"use strict";


addMessageListener( "web-storage-viewer@oyenamit:remove-all-local", onRemoveAllItems );
addMessageListener( "web-storage-viewer@oyenamit:remove-selected-local", onRemoveSelectedItems );
addEventListener( "unload", onUnload, false );


// ---------------------------------------------------------------------------------------------------------
// Clears the local storage for current domain
// ---------------------------------------------------------------------------------------------------------
function onRemoveAllItems( msg )
{
    try
    {
        content.localStorage.clear();
    }
    catch( e ) {}
}


// ---------------------------------------------------------------------------------------------------------
// Deletes specific items from local storage for current domain
// ---------------------------------------------------------------------------------------------------------
function onRemoveSelectedItems( msg )
{
    var deleteItems = msg.data;

    for (var i = 0; i < deleteItems.length; ++i )
    {
        var item = deleteItems[i];

        if( content.document.location.href.indexOf( item.rawHost ) != -1 )
        {
            try
            {
                content.localStorage.removeItem( item.name );
            }
            catch( e ) {}
        }
    }
}


// ---------------------------------------------------------------------------------------------------------
// Called when user closes the current tab.
// ---------------------------------------------------------------------------------------------------------
function onUnload( event )
{
    removeEventListener( "unload", onUnload, false );
    removeMessageListener( "web-storage-viewer@oyenamit:remove-all-local", onRemoveAllItems );
    removeMessageListener( "web-storage-viewer@oyenamit:remove-selected-local", onRemoveSelectedItems );
}

