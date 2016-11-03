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


/*jshint sub: true */


"use strict";


// ---------------------------------------------------------------------------------------------------------
// The module exports only one symbol.
// It serves as a namespace for all public functions and variables.
// ---------------------------------------------------------------------------------------------------------
this.EXPORTED_SYMBOLS = [ "WebStorageTreeView" ];
var WebStorageTreeView = {};


// ---------------------------------------------------------------------------------------------------------
// Interface attribute for nsITreeView.
// The number of items in the tree view.
// ---------------------------------------------------------------------------------------------------------
WebStorageTreeView.rowCount = 0;


// ---------------------------------------------------------------------------------------------------------
// Interface attribute for nsITreeView.
// Current user selection for the view.
// ---------------------------------------------------------------------------------------------------------
WebStorageTreeView.selection = null;


// ---------------------------------------------------------------------------------------------------------
// An object whose property names are domain names (bbc.com) and
// values are objects of type Level0ContainerItem.
// ---------------------------------------------------------------------------------------------------------
WebStorageTreeView.hosts = {};


// ---------------------------------------------------------------------------------------------------------
// An array containing sorted list of domain names (bbc.com)
// ---------------------------------------------------------------------------------------------------------
WebStorageTreeView.hostOrder = [];


// ---------------------------------------------------------------------------------------------------------
// Indicates if the view is currently filtered or not.
// ---------------------------------------------------------------------------------------------------------
WebStorageTreeView.filtered = false;


// ---------------------------------------------------------------------------------------------------------
// Internal cache for looking up items.
// ---------------------------------------------------------------------------------------------------------
var cacheValid = 0;
var cacheItems = [];


// ---------------------------------------------------------------------------------------------------------
// Array of items that match currently active filter.
// ---------------------------------------------------------------------------------------------------------
var filterSet = [];


// ---------------------------------------------------------------------------------------------------------
// The front end box object linked with the tree view.
// ---------------------------------------------------------------------------------------------------------
var treeBoxObject = null;


// ---------------------------------------------------------------------------------------------------------
// Object holding the 'outer' scope.
// This is required because access to objects like console are not directly available.
// ---------------------------------------------------------------------------------------------------------
var outer = null;


// ---------------------------------------------------------------------------------------------------------
// Interface method for nsITreeView.
// ---------------------------------------------------------------------------------------------------------
WebStorageTreeView.getCellText = function( aIndex, aColumn )
{
    var cellText = "";

    if ( !this.filtered )
    {
        var item = this.getItemAtIndex( aIndex );
        if( item )
        {
            if( aColumn.id == "domainCol" )
                cellText = item.rawHost;
            else if( aColumn.id == "nameCol" )
                cellText = item.name;
            else if( aColumn.id == "valueCol" )
                cellText = item.value;
        }
    }
    else
    {
        if( aColumn.id == "domainCol" )
            cellText = filterSet[aIndex].rawHost;
        else if( aColumn.id == "nameCol" )
            cellText = filterSet[aIndex].name;
        else if( aColumn.id == "valueCol" )
            cellText = filterSet[aIndex].value;
    }
    
    return cellText;
};


// ---------------------------------------------------------------------------------------------------------
// Interface method for nsITreeView.
// ---------------------------------------------------------------------------------------------------------
WebStorageTreeView.getLevel = function( aIndex ) 
{
    var level = 0;

    if( !this.filtered )
    {
        var item = this.getItemAtIndex( aIndex );
        if( item )
        {
            level = item.level;
        }
    }
    else
    {
        level = 0;
    }

    return level;
};


// ---------------------------------------------------------------------------------------------------------
// Interface method for nsITreeView.
// ---------------------------------------------------------------------------------------------------------
WebStorageTreeView.getParentIndex = function( aIndex )
{
    // -----------------------------------------------------------------------------------------------------
    // Top-level items will have parentIndex as -1
    // We must ensure to return correct parentIndex otherwise
    // we will end up in an infinite loop.
    // -----------------------------------------------------------------------------------------------------
    var parentIndex = -1;

    if( !this.filtered )
    {
        var item = this.getItemAtIndex( aIndex );

        // If an item is not a container, it means it is not top-level. It will have parentIndex != -1
        if( item && !item.container )
        {
            parentIndex = item.parentIndex;
        }
    }
    else
    {
        parentIndex = -1;
    }

    return parentIndex;
};


// ---------------------------------------------------------------------------------------------------------
// Interface method for nsITreeView.
// ---------------------------------------------------------------------------------------------------------
WebStorageTreeView.hasNextSibling = function( aParentIndex, aIndex )
{ 
    var retVal = false;

    // -----------------------------------------------------------------------------------------------------
    // aParentIndex appears to be bogus, but we can get the real
    // parent index by getting the entry for aIndex and reading the
    // parentIndex field.
    // The index of the last item in this host collection is the
    // index of the parent + the size of the host collection, and
    // aIndex has a next sibling if it is less than this value.
    // -----------------------------------------------------------------------------------------------------

    if( !this.filtered )
    {
        var item = this.getItemAtIndex( aIndex );
        if( item )
        {
            if( item.container )
            {
                for( var i = aIndex + 1; i < this.rowCount; ++i )
                {
                    var nextItem = this.getItemAtIndex( i );
                    if ( nextItem.container )
                    {
                        retVal = true;
                        break;
                    }
                }
            }
            else
            {
                var parentItem = this.getItemAtIndex( item.parentIndex );
                if ( parentItem && parentItem.container )
                {
                    retVal = ( aIndex < ( item.parentIndex + parentItem.storageItems.length ) );
                }
            }
        }
    }
    else
    {
        retVal = ( aIndex < ( this.rowCount - 1 ) );
    }

    return retVal;
};


// ---------------------------------------------------------------------------------------------------------
// Interface method for nsITreeView.
// ---------------------------------------------------------------------------------------------------------
WebStorageTreeView.isContainer = function( aIndex )
{
    var retVal = false;

    if( !this.filtered )
    {
        var item = this.getItemAtIndex( aIndex );
        if( item )
        {
            retVal = item.container;
        }
    }
    else
    {
        retVal = false;
    }

    return retVal;
};


// ---------------------------------------------------------------------------------------------------------
// Interface method for nsITreeView.
// ---------------------------------------------------------------------------------------------------------
WebStorageTreeView.isContainerEmpty = function( aIndex )
{ 
    var isEmpty = false;

    if( !this.filtered )
    {
        var item = this.getItemAtIndex( aIndex );
        if( item )
        {
            isEmpty = ( item.storageItems.length === 0 );
        }
    }
    else
    {
        isEmpty = false;
    }

    return isEmpty;
};


// ---------------------------------------------------------------------------------------------------------
// Interface method for nsITreeView.
// ---------------------------------------------------------------------------------------------------------
WebStorageTreeView.isContainerOpen = function( aIndex )
{
   var isOpen = false;

   if( !this.filtered )
   {
      var item = this.getItemAtIndex( aIndex );
      if( item )
      {
         isOpen = item.open;
      }
   }
   else
   {
       isOpen = false;
   }

   return isOpen;
};


// ---------------------------------------------------------------------------------------------------------
// Interface method for nsITreeView.
// ---------------------------------------------------------------------------------------------------------
WebStorageTreeView.toggleOpenState = function( aIndex )
{
    if( !this.filtered )
    {
        var item = this.getItemAtIndex( aIndex );
        if( item )
        {
            invalidateCache( aIndex );

            var multiplier = item.open ? -1 : 1;
            var delta = multiplier * item.storageItems.length;

            this.rowCount += delta;

            item.open = !item.open;

            treeBoxObject.rowCountChanged( aIndex + 1, delta );
            treeBoxObject.invalidateRow( aIndex );
        }
    }
    else
    {
        // Do nothing if it is filtered
    }
};


// ---------------------------------------------------------------------------------------------------------
// Interface method for nsITreeView.
// ---------------------------------------------------------------------------------------------------------
WebStorageTreeView.setTree = function( aTree )
{
    treeBoxObject = aTree;
};


// ---------------------------------------------------------------------------------------------------------
// Interface methods for nsITreeView.
// ---------------------------------------------------------------------------------------------------------
WebStorageTreeView.canDrop              = function( aIndex, aOrientation ) { return false; };
WebStorageTreeView.cycleCell            = function( aIndex, aColumn ) { };
WebStorageTreeView.cycleHeader          = function( aColumn ) { };
WebStorageTreeView.drop                 = function( aIndex, aOrientation ) { };
WebStorageTreeView.getCellValue         = function( aIndex, aColumn ) { };
WebStorageTreeView.getImageSrc          = function( aIndex, aColumn ) { };
WebStorageTreeView.getProgressMode      = function( aIndex, aColumn ) { };
WebStorageTreeView.isEditable           = function( aIndex, aColumn ) { return false; };
WebStorageTreeView.isSelectable         = function( aIndex, aColumn ) { return false; };
WebStorageTreeView.isSeparator          = function( aIndex ) { return false; };
WebStorageTreeView.isSorted             = function() { return false; };
WebStorageTreeView.performAction        = function( aAction ) { };
WebStorageTreeView.performActionOnCell  = function( aAction, aIndex, aColumn ) { };
WebStorageTreeView.performActionOnRow   = function( aAction, aIndex ) { };
WebStorageTreeView.selectionChanged     = function() { };
WebStorageTreeView.setCellText          = function( aIndex, aColumn, aValue ) { };
WebStorageTreeView.setCellValue         = function( aIndex, aColumn, aValue ) { };



// ---------------------------------------------------------------------------------------------------------
// Returns a Level0 or Level1 item at specified index in the tree.
// Called by dialog jsm.
// ---------------------------------------------------------------------------------------------------------
WebStorageTreeView.getItemAtIndex = function( aIndex )
{
    var item = null;

    if( !this.filtered )
    {
        var start     = 0;
        var count     = 0;
        var hostIndex = 0;

        var cacheIndex = Math.min( cacheValid, aIndex );
        if( cacheIndex > 0 )
        {
            var cacheItem = cacheItems[cacheIndex];
            start = cacheItem['start'];
            count = cacheItem['count'];
            hostIndex = count;
        }

        for( var i = start; i < this.hostOrder.length; ++i )
        {
            var currHost = this.hosts[this.hostOrder[i]];
            if( !currHost )
            {
                continue;
            }

            if( count == aIndex )
            {
                item = currHost;
                break;
            }

            hostIndex = count;

            var cacheEntry = { 'start': i, 'count': count };
            var cacheStart = count;

            if( currHost.open )
            {
                if( count < aIndex && aIndex <= ( count + currHost.storageItems.length ) ) 
                {
                    ++count;
                    for( var k = 0; k < currHost.storageItems.length; ++k )
                    {
                        if( count == aIndex )
                        {
                            item = currHost.storageItems[k];
                            item.parentIndex = hostIndex;
                            return item;
                        }

                        ++count;
                    }
                }
                else
                {
                    count += currHost.storageItems.length + 1;
                }
            }
            else
            {
                ++count;
            }

            for( var j = cacheStart; j < count; j++ )
            {
                cacheItems[j] = cacheEntry;
            }

            cacheValid = count - 1;
        }
    }
    else
    {
        item = filterSet[aIndex];
    }

    return item;
};


// ---------------------------------------------------------------------------------------------------------
// Removes all items from the tree view.
// Called by dialog jsm.
// ---------------------------------------------------------------------------------------------------------
WebStorageTreeView.removeAllItems = function()
{
    var deleteItems = [];
    var oldRowCount = this.rowCount;

    if( !this.filtered )
    {
        this.hosts     = {};
        this.hostOrder = [];
    }
    else
    {
        for( var i = 0; i < this.rowCount; ++i )
        {
            deleteItems.push( this.getItemAtIndex( i ) );
        }

        removeItemAtIndex( 0, this.rowCount );
    }

    this.rowCount = 0;
    treeBoxObject.rowCountChanged( 0, -oldRowCount );
    this.selection.clearSelection();    

    return deleteItems;
};


// ---------------------------------------------------------------------------------------------------------
// Removes items currently selected by the user. It returns an array of items that were deleted.
// Called by dialog jsm.
// ---------------------------------------------------------------------------------------------------------
WebStorageTreeView.removeSelectedItems = function()
{
    var deleteItems = [];
    var seln        = this.selection;

    if( seln.count >= 1 )
    {
        var nextSelected    = 0;
        var rowCountImpact  = 0;
        

        if( !this.filtered )
        {
            var ci = seln.currentIndex;
            nextSelected = ci;
            var invalidateRow = -1;
            var item = this.getItemAtIndex( ci );

            if( item.container )
            {
                rowCountImpact -= ( item.open ? item.storageItems.length : 0 ) + 1;
                deleteItems = deleteItems.concat( item.storageItems );
                if( !this.hasNextSibling( -1, ci ) )
                {
                    --nextSelected;
                }

                removeItemAtIndex( ci );
            }
            else
            {
                var parentItem = this.getItemAtIndex( item.parentIndex );
                --rowCountImpact;

                if( parentItem.storageItems.length == 1 )
                {
                    --rowCountImpact;
                    deleteItems.push( item );
                    if( !this.hasNextSibling( -1, ci ) )
                        --nextSelected;
                    if( !this.hasNextSibling( -1, item.parentIndex ) )
                        --nextSelected;

                    removeItemAtIndex( item.parentIndex );
                    invalidateRow = item.parentIndex;
                }
                else
                {
                    deleteItems.push( item );
                    if( !this.hasNextSibling( -1, ci ) )
                        --nextSelected;

                    removeItemAtIndex( ci );
                }
            }

            this.rowCount += rowCountImpact;
            treeBoxObject.rowCountChanged( ci, rowCountImpact );
            if( invalidateRow != -1 )
            {
                treeBoxObject.invalidateRow( invalidateRow );
            }
        }
        else
        {
            var rangeCount = seln.getRangeCount();

            for( var i = rangeCount - 1; i >= 0; --i )
            {
                var min = {};
                var max = {};

                seln.getRangeAt( i, min, max );
                nextSelected = min.value;

                for( var j = min.value; j <= max.value; ++j )
                {
                    deleteItems.push( this.getItemAtIndex( j ) );
                    if( !this.hasNextSibling( -1, max.value ) )
                    {
                        --nextSelected;
                    }
                }

                var delta = max.value - min.value + 1;
                removeItemAtIndex( min.value, delta );

                rowCountImpact = -1 * delta;
                this.rowCount += rowCountImpact;
                treeBoxObject.rowCountChanged( min.value, rowCountImpact );
            }
        }

        if( nextSelected < 0 )
        {
            seln.clearSelection();
        }
        else
        {
            seln.select( nextSelected );
        }
    }

    return deleteItems;
};


// ---------------------------------------------------------------------------------------------------------
// Searches items that match user specified text and stores them in 'filterSet'.
// Called by dialog jsm.
// ---------------------------------------------------------------------------------------------------------
WebStorageTreeView.applyFilter = function( filterText )
{
    var filteredItems = [];
    for( var i = 0; i < this.hostOrder.length; ++i )
    {
        var currHost = this.hosts[this.hostOrder[i]];
        if( currHost )
        {
            for( var j = 0; j < currHost.storageItems.length; ++j )
            {
                var item = currHost.storageItems[j];
                if( itemMatchesFilter( item, filterText ) )
                {
                    filteredItems.push( item );
                }
            }
        }
    }

    filterSet = filteredItems;
    this.filtered = true;

    var oldCount = this.rowCount;
    this.rowCount = 0;
    treeBoxObject.rowCountChanged( 0, -oldCount );

    this.rowCount = filterSet.length;
    treeBoxObject.rowCountChanged( 0, this.rowCount );
};


// ---------------------------------------------------------------------------------------------------------
// Resets any active filter.
// Called by dialog jsm.
// ---------------------------------------------------------------------------------------------------------
WebStorageTreeView.clearFilter = function()
{
    this.filtered = false;
    this.rowCount = 0;
    treeBoxObject.rowCountChanged( 0, -filterSet.length );
    filterSet = [];
};


// ---------------------------------------------------------------------------------------------------------
// Sorts items when filter is active.
// Called by dialog jsm.
// ---------------------------------------------------------------------------------------------------------
WebStorageTreeView.sort = function( sortByPropertyFunc, ascending )
{
    if( this.filtered )
    {
        filterSet.sort( sortByPropertyFunc );

        if( !ascending )
        {
            filterSet.reverse();
        }
    }

    invalidateCache( 0 );
    this.selection.clearSelection();
    this.selection.select( 0 );
    treeBoxObject.invalidate();
    treeBoxObject.ensureRowIsVisible( 0 );
};


// ---------------------------------------------------------------------------------------------------------
// Outer scope setter.
// Called by dialog jsm.
// ---------------------------------------------------------------------------------------------------------
WebStorageTreeView.setOuter = function ( outer_scope )
{
    outer = outer_scope;
};


// ---------------------------------------------------------------------------------------------------------
// Helper function to remove item at specified index in the view.
// ---------------------------------------------------------------------------------------------------------
function removeItemAtIndex( aIndex, aCount )
{
    var removeCount = (aCount === undefined) ? 1 : aCount;
    var parentItem  = {};
    var item        = {};

    if( !WebStorageTreeView.filtered )
    {
        item = WebStorageTreeView.getItemAtIndex( aIndex );
        if( item )
        {
            invalidateCache( aIndex -1 );
            if( item.container )
            {
                WebStorageTreeView.hosts[item.rawHost] = null;
            }
            else
            {
                parentItem = WebStorageTreeView.getItemAtIndex( item.parentIndex );
                for( var i = 0; i < parentItem.storageItems.length; ++i )
                {
                    var s = parentItem.storageItems[i];
                    if( item.rawHost == s.rawHost &&
                        item.name == s.name && 
                        item.value == s.value )
                    {
                        parentItem.storageItems.splice( i, removeCount );
                    }
                }
            }
        }
    }
    else
    {
        for( var j = aIndex; j < aIndex + removeCount; ++j )
        {
            item = filterSet[j];
            parentItem = WebStorageTreeView.hosts[item.rawHost];
            for( var k = 0; k < parentItem.storageItems.length; ++k )
            {
                if( item == parentItem.storageItems[k] )
                {
                    parentItem.storageItems.splice( k, 1 );
                    break;
                }
            }
        }

        filterSet.splice( aIndex, removeCount );
    }
}


// ---------------------------------------------------------------------------------------------------------
// Helper function to match an item with search text entered by user.
// ---------------------------------------------------------------------------------------------------------
function itemMatchesFilter( item, filterText )
{
    var matches           = false;
    var filterTextLwrCase = filterText.toLowerCase();

    if( ( item.rawHost.toLowerCase().indexOf( filterTextLwrCase ) != -1 ) || 
        ( item.name.toLowerCase().indexOf( filterTextLwrCase    ) != -1 ) || 
        ( item.value.toLowerCase().indexOf( filterTextLwrCase   ) != -1 ) )
    {
        matches = true;
    }

    return matches;
}


// ---------------------------------------------------------------------------------------------------------
// Trims the internal cache.
// ---------------------------------------------------------------------------------------------------------
function invalidateCache( aIndex )
{
    cacheValid = Math.min( cacheValid, aIndex );
}

