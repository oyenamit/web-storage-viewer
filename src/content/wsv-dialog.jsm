/* ***** BEGIN LICENSE BLOCK *****
 *
 * Copyright (C) 2016 Namit Bhalla (oyenamit@gmail.com)
 * This file is part of 'Web Storage Viewer' extension for the Firefox browser.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * Alternatively, the contents of this file may be used under the terms
 * of the GNU General Public License Version 3 or above, as described below:
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


/*global Components, Services, Sqlite, Task, WebStorageTreeView */
/*jshint strict: global, white: true, esversion: 6, moz: true   */


"use strict";


Components.utils.import( "resource://gre/modules/Services.jsm" );
Components.utils.import( "resource://gre/modules/Sqlite.jsm"   );
Components.utils.import( "resource://gre/modules/Task.jsm"     );


// ---------------------------------------------------------------------------------------------------------
// The module exports only one symbol. 
// It serves as a namespace for all public functions and variables.
// ---------------------------------------------------------------------------------------------------------
this.EXPORTED_SYMBOLS = [ "WebStorageViewerDlg" ];
var WebStorageViewerDlg = {};


// ---------------------------------------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------------------------------------
const MAX_VALUE_LEN         = 512;
const LOG_MSG_PREFIX        = "wsv 0.1: ";


// ---------------------------------------------------------------------------------------------------------
// The XUL tree in Web Storage dialog.
// ---------------------------------------------------------------------------------------------------------
var storageItemsTree        = null;


// ---------------------------------------------------------------------------------------------------------
// The nsITreeView associated with the XUL tree.
// ---------------------------------------------------------------------------------------------------------
var treeView                = null;


// ---------------------------------------------------------------------------------------------------------
// The SQLite connection to local storage database.
// ---------------------------------------------------------------------------------------------------------
var conn                    = null;


// ---------------------------------------------------------------------------------------------------------
// Object holding the 'outer' or 'calling' scope.
// This is required because access to objects like document and console are not directly available.
// ---------------------------------------------------------------------------------------------------------
var outer                   = null;


// ---------------------------------------------------------------------------------------------------------
// These objects hold the state of the tree and so that it can be saved and restored .
// ---------------------------------------------------------------------------------------------------------
var lastSortProperty        = "";
var lastSortAscending       = false;
var lastSelectedRanges      = [];
var openIndices             = [];


// ---------------------------------------------------------------------------------------------------------
// Initializes the Web Storage dialog.
// It is called before the dialog is actually loaded.
// ---------------------------------------------------------------------------------------------------------
WebStorageViewerDlg.init = function( outer_scope )
{
    outer = outer_scope;

    // -----------------------------------------------------------------------------------------------------
    // Load the chrome process script.
    // We will not unload it so that it remains available till Firefox terminates.
    // -----------------------------------------------------------------------------------------------------
    Components.utils.import( "chrome://web-storage-viewer/content/wsv-chrome-process-script.jsm" );
};


// ---------------------------------------------------------------------------------------------------------
// Called when Web Storage dialog is about to be displayed to the user.
// ---------------------------------------------------------------------------------------------------------
WebStorageViewerDlg.onLoad = Task.async( function* ()
{
    Components.utils.import( "chrome://web-storage-viewer/content/wsv-tree-view.jsm" );
    treeView = WebStorageTreeView;
    treeView.setOuter( outer );

    storageItemsTree = outer.document.getElementById( "webStorageList" );
    focusFilterBox();

    try
    {
        yield initWebStorage();

        yield populateList( true );
    }
    catch( e ) { logMsg( e.message ); }
});


// ---------------------------------------------------------------------------------------------------------
// Called when user closes the Web Storage dialog.
// ---------------------------------------------------------------------------------------------------------
WebStorageViewerDlg.onUnload = function( event )
{
    deinitWebStorage();
    Components.utils.unload( "chrome://web-storage-viewer/content/wsv-tree-view.jsm" );
};


// ---------------------------------------------------------------------------------------------------------
// Called when one or more items are selected in the tree.
// ---------------------------------------------------------------------------------------------------------
WebStorageViewerDlg.onItemSelected = function()
{
    // -----------------------------------------------------------------------------------------------------
    // This is a hack to make sure we do not enable the 'remove' button when there is no actual selection.
    // If we just consider treeView.selection.count, then we incorrectly enable the button even when there
    // are no items and the dialog is opened. By adding the condition of treeView.rowCount, the behavior
    // becomes correct.
    // -----------------------------------------------------------------------------------------------------
    outer.document.getElementById( "removeSelectedItem" ).disabled = !( ( treeView.rowCount > 0 ) && 
                                                                        ( treeView.selection.count > 0 ) );
};


// ---------------------------------------------------------------------------------------------------------
// Called when user requests to refresh the storage items.
// It will remove all the currently displayed items and load everything again from local storage database.
// ---------------------------------------------------------------------------------------------------------
WebStorageViewerDlg.onRefresh = Task.async( function* ()
{
    treeView.removeAllItems();

    try
    {
        yield populateList( false );

        // When user refreshes, lets reset the sorting also. Otherwise, it is not consistent.
        lastSortProperty   = "";
        lastSortAscending  = false;    

        yield this.onSort( "rawHost" );
    }
    catch( e ) { logMsg( e.message ); }

    focusFilterBox();

    // Do not clear the filter here. User might be refreshing to view newly added items.
});


// ---------------------------------------------------------------------------------------------------------
// Called when user requests to delete all items in the tree.
// ---------------------------------------------------------------------------------------------------------
WebStorageViewerDlg.onRemoveAllItems = Task.async( function* ()
{
    if( !treeView.filtered )
    {
        // Remove the items from the view.
        treeView.removeAllItems();

        try
        {
            // Remove the items from local storage database.
            yield removeAllItems();

            // ---------------------------------------------------------------------------------------------
            // Even if we remove the items from local storage database, Firefox holds the values in memory
            // for currently open tabs.
            // So, the websites would still be able to read these values.
            // We need to delete these items from content.localStorage of currently opened tabs.
            // So, inform the framescripts that all items have been deleted.
            // ---------------------------------------------------------------------------------------------
            Services.mm.broadcastAsyncMessage( "web-storage-viewer@oyenamit:remove-all-local" );
        }
        catch( e ) { logMsg( e.message ); }
    }
    else
    {
        // -------------------------------------------------------------------------------------------------
        // Remove the items from the view.
        // The return value is an array of items that were actually deleted.
        // -------------------------------------------------------------------------------------------------
        var deleteItems = treeView.removeAllItems();

        try
        {
            // Remove the items from local storage database.
            yield removeSelectedItems( deleteItems );

            // ---------------------------------------------------------------------------------------------
            // Even if we remove the items from local storage database, Firefox holds the values in memory
            // for currently open tabs.
            // So, the websites would still be able to read these values.
            // We need to delete these items from content.localStorage of currently opened tabs.
            // So, inform the framescripts that items have been deleted.
            // ---------------------------------------------------------------------------------------------
            Services.mm.broadcastAsyncMessage( "web-storage-viewer@oyenamit:remove-selected-local", deleteItems );
        }
        catch( e ) { logMsg( e.message ); }
    }

    updateRemoveAllButton();
    focusFilterBox();
});


// ---------------------------------------------------------------------------------------------------------
// Called when user requests to delete selected item(s).
// ---------------------------------------------------------------------------------------------------------
WebStorageViewerDlg.onRemoveSelectedItem = Task.async( function* ()
{
    // -----------------------------------------------------------------------------------------------------
    // Remove the items from the view.
    //  The return value is an array of items that were actually deleted.
    // -----------------------------------------------------------------------------------------------------
    var deleteItems = treeView.removeSelectedItems();

    try
    {
        // Remove the items from local storage database.
        yield removeSelectedItems( deleteItems );

        // ---------------------------------------------------------------------------------------------
        // Even if we remove the items from local storage database, Firefox holds the values in memory
        // for currently open tabs.
        // So, the websites would still be able to read these values.
        // We need to delete these items from content.localStorage of currently opened tabs.
        // So, inform the framescripts that items have been deleted.
        // ---------------------------------------------------------------------------------------------
        Services.mm.broadcastAsyncMessage( "web-storage-viewer@oyenamit:remove-selected-local", deleteItems );
    }
    catch( e ) { logMsg( e.message ); }

    storageItemsTree.focus();
    
    updateRemoveAllButton();
});


// ---------------------------------------------------------------------------------------------------------
// Called when user filters the items in the tree or clears the filter.
// ---------------------------------------------------------------------------------------------------------
WebStorageViewerDlg.onFilter = Task.async( function* ()
{
    var filterText = outer.document.getElementById( "filter" ).value;

    if( filterText !== "" )
    {
        // -------------------------------------------------------------------------------------------------
        // User has entered some text in filter box.
        // -------------------------------------------------------------------------------------------------

        if( !treeView.filtered )
        {
            saveState();
        }

        // In filter mode, we allow user to select more than one items.
        storageItemsTree.setAttribute( "seltype", "multiple" );

        treeView.applyFilter( filterText );

        if( treeView.rowCount > 0 )
        {
            treeView.selection.select( 0 );
        }

        // TODO: Change string of label to "Filtered items"
    }
    else
    {
        // -------------------------------------------------------------------------------------------------
        // User has cleared the filter.
        // -------------------------------------------------------------------------------------------------
        try
        {
            yield clearFilter();
        }
        catch( e ) { logMsg( e.message ); }
    }

    updateRemoveAllButton();
});


// ---------------------------------------------------------------------------------------------------------
// Called when user sorts the items in the tree.
// ---------------------------------------------------------------------------------------------------------
WebStorageViewerDlg.onSort = function( aProperty )
{
    function sortByHost( a, b )
    {
        return a.toLowerCase().localeCompare( b.toLowerCase() );
    }

    function sortByProperty( a, b )
    {
        return a[aProperty].toLowerCase().localeCompare( b[aProperty].toLowerCase() );
    }

    var ascending = ( aProperty == lastSortProperty ) ? !lastSortAscending : true;

    if( aProperty == "rawHost" )
    {
        treeView.hostOrder.sort( sortByHost );

        if( !ascending )
        {
            treeView.hostOrder.reverse();
        }
    }

    for( var host in treeView.hosts )
    {
        var items = treeView.hosts[host].storageItems;
        items.sort( sortByProperty );

        if( !ascending )
        {
            items.reverse();
        }
    }

    treeView.sort( sortByProperty, ascending );

    var domainCol   = outer.document.getElementById( "domainCol" );
    var nameCol     = outer.document.getElementById( "nameCol" );
    var valueCol    = outer.document.getElementById( "valueCol" );

    var sortOrderString = ascending ? "ascending" : "descending";

    if( aProperty == "rawHost" )
    {
        domainCol.setAttribute( "sortDirection", sortOrderString );
        nameCol.removeAttribute( "sortDirection" );
        valueCol.removeAttribute( "sortDirection" );
    }
    else if( aProperty == "name" )
    {
        nameCol.setAttribute( "sortDirection", sortOrderString );
        domainCol.removeAttribute( "sortDirection" );
        valueCol.removeAttribute( "sortDirection" );
    }
    else if( aProperty == "value" )
    {
        valueCol.setAttribute( "sortDirection", sortOrderString );
        domainCol.removeAttribute( "sortDirection" );
        nameCol.removeAttribute( "sortDirection" );
    }

    lastSortAscending = ascending;
    lastSortProperty = aProperty;
};


// ---------------------------------------------------------------------------------------------------------
// Called when user presses a key in the tree.
// ---------------------------------------------------------------------------------------------------------
WebStorageViewerDlg.onItemKeyPress = Task.async( function* ( aEvent )
{
    if( aEvent.keyCode == outer.KeyEvent.DOM_VK_DELETE )
    {
        try
        {
            yield this.onRemoveSelectedItem();
        }
        catch( e ) { logMsg( e.message ); }
    }
});


// ---------------------------------------------------------------------------------------------------------
// Called when user presses a key in the Web Storage dialog.
// ---------------------------------------------------------------------------------------------------------
WebStorageViewerDlg.onWindowKeyPress = function( aEvent )
{
    if( aEvent.keyCode == outer.KeyEvent.DOM_VK_ESCAPE )
    {
        outer.window.close();
    }
};


// ---------------------------------------------------------------------------------------------------------
// Initializes local storage database connection.
// ---------------------------------------------------------------------------------------------------------
function* initWebStorage()
{
    conn = yield Sqlite.openConnection( {path: "webappsstore.sqlite"} );
}


// ---------------------------------------------------------------------------------------------------------
// Terminates local storage database connection.
// ---------------------------------------------------------------------------------------------------------
function deinitWebStorage()
{
    if( conn )
    {
        conn.discardCachedStatements();
        conn.close();
        conn = null;
    }
}


// ---------------------------------------------------------------------------------------------------------
// Queries local storage database and loads the items into the tree view.
// ---------------------------------------------------------------------------------------------------------
function* loadWebStorageItems()
{
    var hostCount       = { value: 0 };
    treeView.hosts      = {};
    treeView.hostOrder  = [];

    yield conn.execute( "SELECT scope, key, value FROM webappsstore2", null, (row) => {

        var origHost = row.getResultByName( "scope" );
        var name     = row.getResultByName( "key" );
        var value    = "";
        var rawValue = row.getResultByName( "value" );

        // -------------------------------------------------------------------------------------------------
        // Limit the length of values to MAX_VALUE_LEN
        // We want to avoid storing and showing very large values to the user.
        // -------------------------------------------------------------------------------------------------
        if( rawValue.length > MAX_VALUE_LEN )
        {
            value = rawValue.substring( 0, MAX_VALUE_LEN ) + "...";
        }
        else
        {
            value = rawValue;
        }

        var newItem = new RawWebStorageItem( origHost, name, value);

        var strippedHost = makeStrippedHost( newItem.host );
        addStorageItem( strippedHost, newItem, hostCount );
    } 
    );

    treeView.rowCount = hostCount.value;
}


// ---------------------------------------------------------------------------------------------------------
// Loads the items and initializes the dialog for display.
// ---------------------------------------------------------------------------------------------------------
function* populateList( aInitialLoad )
{
    yield loadWebStorageItems();

    storageItemsTree.view = treeView;

    if( aInitialLoad )
    {
        WebStorageViewerDlg.onSort( "rawHost" );

        if( "arguments" in outer.window && outer.window.arguments[0] && outer.window.arguments[0].filterString )
        {
            outer.document.getElementById( "filter" ).value = outer.window.arguments[0].filterString;
            yield WebStorageViewerDlg.onFilter();
        }
    }
    else
    {
        if( outer.document.getElementById( "filter" ).value !== "" )
        {
            yield WebStorageViewerDlg.onFilter();
        }
    }
        

    if( treeView.rowCount > 0 )
    {
        treeView.selection.select( 0 );

        // -------------------------------------------------------------------------------------------------
        // This is a hack to ensure that when dialog is populated and initialized, 
        // we receive onItemSelected notification. Otherwise, behavior is very inconsistent.
        // -------------------------------------------------------------------------------------------------
        WebStorageViewerDlg.onItemSelected();
    }

    updateRemoveAllButton();

    saveState();
}


// ---------------------------------------------------------------------------------------------------------
// Converts the host name read from local storage database into usable form.
// ---------------------------------------------------------------------------------------------------------
function sanitizeHost( aHost )
{
    // -----------------------------------------------------------------------------------------------------
    // The host name in local storage database is of the form:
    // moc.cbb.www.:http:80
    // We need to remove the port and protocol and then reverse it.
    // -----------------------------------------------------------------------------------------------------
    var sanitizedHost = aHost;

    var parts = aHost.split( ":" );
    sanitizedHost = parts[0].split( '' ).reverse().join( '' );

    return sanitizedHost;
}


// ---------------------------------------------------------------------------------------------------------
// Removes '.www.' prefix (if any) from the host name
// ---------------------------------------------------------------------------------------------------------
function makeStrippedHost( aHost )
{
    // -----------------------------------------------------------------------------------------------------
    // The input host name could of the form .www.bbc.com
    // It needs to be converted to bbc.com
    // -----------------------------------------------------------------------------------------------------
    var formattedHost = aHost.charAt( 0 ) == "." ? aHost.substring( 1, aHost.length ) : aHost;
    return formattedHost.substring( 0, 4 ) == "www." ? formattedHost.substring( 4, formattedHost.length ) : formattedHost;
}


// ---------------------------------------------------------------------------------------------------------
// Raw item - as read from local storage database.
// ---------------------------------------------------------------------------------------------------------
function RawWebStorageItem( origHost, name, value )
{
    this.origHost = origHost;
    this.host = sanitizeHost( origHost );
    this.name = name;
    this.value = value;
}


// ---------------------------------------------------------------------------------------------------------
// Hosts container item to be added to 'hosts' array (level=0 item)
// ---------------------------------------------------------------------------------------------------------
function Level0ContainerItem( strippedHost, origHost )
{
    this.storageItems = [];
    this.rawHost = strippedHost;
    this.origHost = origHost;
    this.level = 0;
    this.open = false;
    this.container = true;
}

// ---------------------------------------------------------------------------------------------------------
// A webstorage item to be added to storageItems array (level=1 item)
// ---------------------------------------------------------------------------------------------------------
function Level1Item( host, strippedHost, origHost, name, value )
{
    this.host = host;
    this.rawHost = strippedHost;
    this.origHost = origHost;
    this.name = name;
    this.value = value;
    this.level = 1;
    this.container = false;
}


// ---------------------------------------------------------------------------------------------------------
// Populates the treeview with a new item
// ---------------------------------------------------------------------------------------------------------
function addStorageItem( aStrippedHost, aStorageItem, aHostCount )
{
    // -----------------------------------------------------------------------------------------------------
    // Check if we already have an item for this host (say, bbc.com)
    // If not, we need to add a new Level0Container entry.
    // -----------------------------------------------------------------------------------------------------
    if( !( aStrippedHost in treeView.hosts ) || !treeView.hosts[aStrippedHost] )
    {
        treeView.hosts[aStrippedHost] = new Level0ContainerItem( aStrippedHost, aStorageItem.origHost );

        treeView.hostOrder.push( aStrippedHost );
        ++aHostCount.value;
    }

    var item = new Level1Item( aStorageItem.host, aStrippedHost, aStorageItem.origHost, aStorageItem.name, aStorageItem.value );
    treeView.hosts[aStrippedHost].storageItems.push( item );
}


// ---------------------------------------------------------------------------------------------------------
// Enables or disables the 'Remove All' button in the Web Storage dialog.
// ---------------------------------------------------------------------------------------------------------
function updateRemoveAllButton()
{
    outer.document.getElementById( "removeAllItems" ).disabled = ( treeView.rowCount === 0 );
}


// ---------------------------------------------------------------------------------------------------------
// Deletes specified items from local storage database.
// ---------------------------------------------------------------------------------------------------------
function* removeSelectedItems( deleteItems )
{
    var delStatement = "DELETE FROM webappsstore2 where scope=:pScope AND key=:pKey";

    for( var i = 0; i < deleteItems.length; ++i )
    {
        var item = deleteItems[i];

        // Replace all single quotes with 2 single quotes otherwise they can cause SQL syntax error.
        var scope = item.origHost.replace( /'/g, "''" );
        var name  = item.name.replace( /'/g, "''" );

        if( conn )
        {
            yield conn.executeCached( delStatement, { pScope: scope, pKey: name} );
        }
    }
}


// ---------------------------------------------------------------------------------------------------------
// Deletes all items from local storage database.
// ---------------------------------------------------------------------------------------------------------
function* removeAllItems()
{
    if( conn )
    {
        yield conn.execute( "DELETE FROM webappsstore2" );
    }
}


// ---------------------------------------------------------------------------------------------------------
// Clears the current filter and re-loads the items.
// ---------------------------------------------------------------------------------------------------------
function* clearFilter()
{
    storageItemsTree.setAttribute( "seltype", "single" );

    treeView.clearFilter();

    yield loadWebStorageItems();
    storageItemsTree.view = treeView;

    var sortBy = lastSortProperty;
    if( sortBy === "" )
    {
        lastSortAscending = false;
        WebStorageViewerDlg.onSort( "rawHost" );
    }
    else
    {
        lastSortAscending = !lastSortAscending;
        WebStorageViewerDlg.onSort( sortBy );
    }

    // Restore open state
    for( var i = 0; i < openIndices.length; ++i )
    {
        treeView.toggleOpenState( openIndices[i] );
    }

    openIndices = [];


    // Restore last selection
    treeView.selection.clearSelection();
    for( var j = 0; j < lastSelectedRanges.length; ++j )
    {
        var range = lastSelectedRanges[j];
        treeView.selection.rangedSelect( range.min, range.max, true );
    }

    lastSelectedRanges = [];

    // TODO: Change string of label back to original

    updateRemoveAllButton();
}


// ---------------------------------------------------------------------------------------------------------
// Sets the focus of cursor to Filter box in the Web Storage dialog.
// ---------------------------------------------------------------------------------------------------------
function focusFilterBox()
{
    var filter = outer.document.getElementById( "filter" );
    filter.focus();
    // filter.select();
}


// ---------------------------------------------------------------------------------------------------------
// Saves the current state of the treeview (selection, open items) when filter becomes active.
// ---------------------------------------------------------------------------------------------------------
function saveState()
{
    var seln = treeView.selection;
    var rangeCount = treeView.selection.getRangeCount();

    lastSelectedRanges = [];
    openIndices = [];

    for( var i = 0; i < rangeCount; ++i )
    {
        var min = {};
        var max = {};

        seln.getRangeAt( i, min, max );
        lastSelectedRanges.push( { min: min.value,  max: max.value } );
    }

    for( var j = 0; j < treeView.rowCount; ++j )
    {
        var item = treeView.getItemAtIndex( j );
        if( item && item.container && item.open )
        {
            openIndices.push( j );
        }
    }
}


// ---------------------------------------------------------------------------------------------------------
// Helper logging function
// ---------------------------------------------------------------------------------------------------------
function logMsg( message )
{
    // Use console.log method if it is available
    if( outer.console && 
        outer.console.log )
    {
        outer.console.log( LOG_MSG_PREFIX + message );
    }
}

