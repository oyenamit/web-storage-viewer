# Web Storage Viewer Firefox Extension
*View and manage the tracking data stored by websites on your system. This data is known by several different names: Web Storage, DOM Storage, HTML5 Storage, Session Storage and Local Storage.*

Most users already know that websites use data stored in [Cookies](http://www.allaboutcookies.org/faqs/cookies.html) to track their browsing activities. Many users clear their cookies regularly to avoid privacy-related issues or use add-ons to manage them. However, a lot of users are not aware that there is another way, called [Web Storage](https://en.wikipedia.org/wiki/Web_storage), for websites to store data on user's system for tracking purposes.

Firefox provides a built-in way for users to view and manage all the Cookies saved on their system but there is no such support for Web Storage. This add-on provides that missing feature by allowing users to view and delete Web Storage data that is permanently stored on their system.

## Installation
You can install the extension by building it from source or by downloading it from the [Mozilla Add-ons](https://addons.mozilla.org/en-US/firefox/addon/web-storage-viewer/) site.

## Usage

1. Go to Firefox *Preferences* (Options)
2. Select the *Privacy* tab
3. Click on the new *"Show Web Storage..."* button.
4. A dialog will appear that shows Web Storage data for each website.

![screenshot](https://addons.cdn.mozilla.net/user-media/previews/full/179/179772.png?modified=1478089864)

![screenshot](https://addons.cdn.mozilla.net/user-media/previews/full/179/179784.png?modified=1478089864)

## Features

1. Web Storage data is grouped by website name for easy viewing.
2. Users can delete an individual item or they can select the website name and delete all items stored by that site.
3. Users can also delete all Web Storage items in one go by selecting the *"Remove All"* button.
4. If the user is looking for a particular site or data, they can use the filter option provided in the dialog. In the filtered list, the user can delete a single item, multiple items or all of the items.
5. Users can click on the column names to sort the items in ascending or descending order

## Limitations of the add-on
The current version of Web Storage Viewer has the following limitations. These limitations might be removed in future versions of the add-on:

1. The primary objective of this add-on is to spread awareness about Web Storage and allow users to view and delete tracking data from their systems. It may not be the best tool for developers who wish to experiment with Web Storage. Instead, they can use the built-in [Storage Inspector](https://developer.mozilla.org/en-US/docs/Tools/Storage_Inspector) tool that displays both Local Storage and Session Storage for the current tab.
2. This add-on displays only the Web Storage data that is permanently stored on the system (Local Storage). It does not show temporary data (Session Storage) to the user. This is because the data saved in Session Storage is specific to a tab and should be viewed in the context of that tab. Collecting session data for all currently open tabs and showing it in one big list may not be of much practical use. Firefox provides [Storage Inspector](https://developer.mozilla.org/en-US/docs/Tools/Storage_Inspector) tool that can be used to view and manage Session Storage for each tab.
3. While the Web Storage Viewer dialog is open and a website updates (add/modify/delete) data in its Local Storage, the changes will not be automatically visible in the dialog. Users need to click on Refresh button to view the updated data.
4. This add-on does not allow the user to edit or copy the Web Storage data.