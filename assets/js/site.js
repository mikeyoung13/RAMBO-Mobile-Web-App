var twitterData = null,
    calendarData = null,
    rssFeedData = null,
    trailStatusData = null;

var ERROR_FLAG = "error",
    TRY_AGAIN_MSG = "Please try again later by pressing 'Update' button.",
    ERROR_MSG_NO_DATA = "Data unavailable. "+TRY_AGAIN_MSG,
    TIMEOUT = 12000;

var twitterTemplate = null,
    calendarTemplate = null,
    rssTemplate = null,
    rssDetailTemplate = null,
    trailStatusTemplate = null;

var mapsAPILoaded = false;

//twitterData = [{"created_at":"Sat May 26 00:01:01 +0000 2012","text":"Good MTB weather people!1"},{"created_at":"Fri May 25 00:01:01 +0000 2012","text":"Good MTB weather people!2"},{"created_at":"Sun May 6 07:30:28 +0000 2012","text":"Good MTB weather people!3"}];

// ISO date parser downloaded 5/26/2012
/** https://github.com/csnover/js-iso8601 */(function(n,f){var u=n.parse,c=[1,4,5,6,7,10,11];n.parse=function(t){var i,o,a=0;if(o=/^(\d{4}|[+\-]\d{6})(?:-(\d{2})(?:-(\d{2}))?)?(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{3}))?)?(?:(Z)|([+\-])(\d{2})(?::(\d{2}))?)?)?$/.exec(t)){for(var v=0,r;r=c[v];++v)o[r]=+o[r]||0;o[2]=(+o[2]||1)-1,o[3]=+o[3]||1,o[8]!=="Z"&&o[9]!==f&&(a=o[10]*60+o[11],o[9]==="+"&&(a=0-a)),i=n.UTC(o[1],o[2],o[3],o[4],o[5]+a,o[6],o[7])}else i=u?u(t):NaN;return i}})(Date)

function getFormattedDate(date) {
    //console.log("Date to string",date.toDateString());
    var dateArray = date.toDateString().split(" ");
    dateArray.pop();
    return dateArray.join(" ");
}

function getFormattedTime(date) {
    var hours = date.getHours();
    var minutes = date.getMinutes();
    var postFix = "am";
    if (hours >= 12) {
        postFix = "pm";
    }
    if (hours > 12) {
        hours-=12;
    }

    if (minutes < 10) {
        minutes = "0" + minutes;
    }
    return hours + ":" + minutes + postFix;
}

function getTimeAgoVerbiage(msec, msecPerPeriod, periodName) {
    var numPeriods = msec / msecPerPeriod;
    var roundedPeriods = Math.round(numPeriods);
    if (roundedPeriods < 2) {
        return "1 "+periodName+" ago";
    } else {
        return roundedPeriods+" "+periodName+"s ago";
    }
}

function getTweetTime(now, oldDate) {

    var MINUTE_MSEC = 60000;
    var HOUR_MSEC = 3600000;
    var DAY_MSEC = 86400000;
    var WEEK_MSEC = 604800000;

    var msec = now - oldDate;

    if (msec < HOUR_MSEC) {
        return getTimeAgoVerbiage(msec,MINUTE_MSEC,"minute");
    } else if (msec <= DAY_MSEC) {
        return getTimeAgoVerbiage(msec,HOUR_MSEC,"hour");
    } else if (msec <= WEEK_MSEC) {
        return getTimeAgoVerbiage(msec,DAY_MSEC,"day");
    }else {
        return getFormattedDate(new Date(oldDate));
    }

}

function generateEventFormattedDates(events) {
    var startDT, endDT,  startDate, startTime, endTime;
    for (var i = 0; i < events.length; i++) {
        var event = events[i];
        if (event.start.date) {
            // Safari and js-iso8601 require the full date
            // add 1:01 to account for daylight savings time
            startDT = getFormattedDate(new Date(Date.parse(event.start.date +"T00:00:00-05:01")));
            // subtract 1:01 to account for daylight savings time and to prevent spillover into midnight of next day for all-day events
            endDT =  getFormattedDate(new Date(Date.parse(event.end.date +"T00:00:00-02:59")));
            if (startDT === endDT) {
                event.formattedDate = startDT;
            } else {
                event.formattedDate = startDT + ' - ' + endDT;
            }
        } else if (event.start.dateTime) {
            startDT = new Date(Date.parse(event.start.dateTime));
            endDT = new Date(Date.parse(event.end.dateTime));

            startDate = getFormattedDate(startDT);
            startTime = getFormattedTime(startDT);
            endTime = getFormattedTime(endDT);

            event.formattedDate = startDate + ", " + startTime + " - " + endTime;

        }
    }
}

function fetchData(){

    $('#lastUpdateDT').html("Updating...");
    $.when(callYQLAsync(), callGoogleCalAsync(), callTwitterAsync())
//        .then (function(){
//            var currentDate = new Date();
//            $('#lastUpdateDT').html(getFormattedDate(currentDate)+" @ "+getFormattedTime(currentDate));
//        })
        .fail (function(){
            alert('One or more network requests failed.  '+TRY_AGAIN_MSG );
        })
        .always(function(){
            $.mobile.hidePageLoadingMsg();
            var currentDate = new Date();
            $('#lastUpdateDT').html(getFormattedDate(currentDate)+" @ "+getFormattedTime(currentDate));
        });
}

function checkNetworkState(networkState) {
    if (networkState == Connection.NONE || networkState == Connection.UNKNOWN) {
        alert("Network is unavailable.  " + TRY_AGAIN_MSG)
    } else {
        fetchData();
    }
}

function loadMaps() {

    var currentLoc;

    var mapOptions = {
        center: new google.maps.LatLng(34.029936,-84.311893),
        zoom: 12,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        mapTypeControlOptions: {
            position: google.maps.ControlPosition.TOP_CENTER
        }
    };
    var map = new google.maps.Map(document.getElementById("map_canvas"),
        mapOptions);

    var southWest = new google.maps.LatLng(34.024058,-84.312258);
    var northEast = new google.maps.LatLng(34.243577,-84.047341);
    var bounds = new google.maps.LatLngBounds(southWest,northEast);
    map.fitBounds(bounds);

    var infoWindow = new google.maps.InfoWindow();

    var markerList = new Array();

    function showMarker(markerId){

        // get marker information from marker list
        var marker = markerList[markerId];

        // get marker detail information from server

        var content = marker.title + '<p><a href="http://maps.google.com/maps?saddr='+currentLoc.toUrlValue()+'&daddr='+marker.position.toUrlValue()+'" target="_blank">Get Directions</a></p>';
        infoWindow.setContent(content);
        infoWindow.open(map, marker);
    }

    function loadMarker(markerData){

        // create new marker location
        var myLatlng = new google.maps.LatLng(markerData['lat'],markerData['long']);

        // create new marker
        var marker = new google.maps.Marker({
            id: markerData.id,
            map: map,
            title: markerData['desc'],
            position: myLatlng,
            icon: "assets/images/bike_downhill.png"
        });

        // add marker to list used later to get content and additional marker information
        markerList[markerData.id] = marker;

        // add event listener when marker is clicked
        // currently the marker data contain a dataurl field this can of course be done different
        google.maps.event.addListener(marker, 'click', function() {

            // show marker when clicked
            showMarker(marker.id);

        });

    }

    function loadMarkers(){
        $.ajax({
            url: 'assets/data/trailMarkers.json',
            type: 'GET',
            dataType: 'json',
            beforeSend: function(){
                // no-op
            },
            success: function(data) {
                // loop all the markers

                $.each(data.markers, function(i,item){
                    // add marker to map
                    item.id = i;
                    loadMarker(item);
                });

            }
        });
    }

    loadMarkers();

    var onSuccess = function(position) {

        currentLoc = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);

        var currentPosMarker = new google.maps.Marker({
            map: map,
            position: currentLoc,
            optimized: false,
            icon: new google.maps.MarkerImage("assets/images/currentPosition1.png", null, null, null, new google.maps.Size(48, 48))
        });

    };

    var onError = function(error) {
        alert('code: '    + error.code    + '\n' +
            'message: ' + error.message + '\n');
    }

    navigator.geolocation.getCurrentPosition(onSuccess, onError);
}

$(document).ready(function() {

    $('#locations').live("pageshow", function() {

        if (mapsAPILoaded) {
            loadMaps();
        } else {
            // load Google Maps on demand
            var script = document.createElement("script");
            script.type = "text/javascript";
            script.src = "http://maps.googleapis.com/maps/api/js?v=3&key=AIzaSyAZEASvv4Go1qssuljASB76T1HQPg_GgW8&sensor=false&callback=loadMaps";
            document.body.appendChild(script);
            mapsAPILoaded = true;
        }


    });

    // show spinner during AJAX requests
    jQuery.ajaxSetup({
        beforeSend: function() {
            $.mobile.showPageLoadingMsg();
        }
    });

    $(document).bind("deviceready", function() {
        //alert("device is ready - jquery)");
        var networkState = navigator.network.connection.type;
        checkNetworkState(networkState);
    });

    // refresh button/link
    $('#refresh').bind("vclick", function() {
        if (navigator.network) {
            var networkState = navigator.network.connection.type;
            checkNetworkState(networkState);
        } else {
            fetchData();
        }
        return false;
    });

    //  Google Groups
    $('#subscribe').bind("click", function(e) {
        e.stopPropagation();
        var email = $('#emailAddress').val().trim();
        if (email.length === 0) {
            alert("Please enter an email address.");
            e.preventDefault();
            return false;
        }
        if (confirm("Your browser will be opened and your email will be passed to Google Groups.  Please follow confirmation instructions given by Google.")) {
            $(this).attr('href','http://groups.google.com/group/rambo-announce/boxsubscribe?email='+encodeURIComponent(email));
            return true;
        } else {
            e.preventDefault();
            return false;
        }
    });

    // compile templates
    twitterTemplate = Handlebars.compile($("#twitter-result-template").html());
    calendarTemplate = Handlebars.compile($("#calendar-result-template").html());
    rssTemplate = Handlebars.compile($("#rss-result-template").html());
    rssDetailTemplate = Handlebars.compile($("#rss-detail-template").html());
    trailStatusTemplate = Handlebars.compile($("#trail-status-template").html());

    Handlebars.registerHelper('timeAgo', function(dateString) {
        var dateMS = Date.parse(dateString);
        var now =  (new Date()).getTime();
        return getTweetTime(now, dateMS);
    });

});

// Listen for any attempts to call changePage().
$(document).bind( "pagebeforechange", function( e, data ) {
    // We only want to handle changePage() calls where the caller is
    // asking us to load a page by URL.
    if ( typeof data.toPage === "string" ) {
        // We are being asked to load a page by URL, but we only
        // want to handle URLs that request the data for a specific
        // category.
        var u = $.mobile.path.parseUrl( data.toPage ),
            rssPath = /^#rssIndex/,
            rssDetails = /^#rssDetails/,
            trailStatusPath = /^#trailStatus/,
            twitterPath = /^#twitter/,
            calendarPath = /^#calendar/,
            locationsPath = /^#locations/;
        if ( u.hash.search(rssPath) !== -1 ) {
            // We're being asked to display the items for a specific category.
            // Call our internal method that builds the content for the category
            // on the fly based on our in-memory category data structure.
            showRSS( u, data.options );

            // Make sure to tell changePage() we've handled this call so it doesn't
            // have to do anything.
            e.preventDefault();
        } else if (u.hash.search(twitterPath) !== -1)  {
            showTwitter( u, data.options );
            e.preventDefault();
        } else if (u.hash.search(calendarPath) !== -1)  {
            showCalendar( u, data.options );
            e.preventDefault();
        } else if (u.hash.search(rssDetails) !== -1)  {
            showRSSDetails( u, data.options );
            e.preventDefault();
        } else if (u.hash.search(trailStatusPath) !== -1)  {
            showTrailStatus( u, data.options );
            e.preventDefault();
        } else if (u.hash.search(locationsPath) !== -1)  {
            showLocations( u, data.options );
            e.preventDefault();
        }

    }
});

function callTwitterAsync() {

    return $.ajax({
        url: 'https://api.twitter.com/1/statuses/user_timeline.json',
        data: {
            user_id: 263189907,
            screen_name: "rambomtb",
            count: 10,
            trim_user: 1
        },
        type: 'GET',
        timeout: TIMEOUT,
        dataType: 'jsonp',

        success: function(json) {
            console.log("done getting Twitter data");
            //print("success");
            //print(Object.keys(json));

            twitterData = json;

//            for (var i=0; i<json.length; i++) {
//                var tweet = json[i];
//                console.log("**************************");
//                console.log("Date: "+ tweet.created_at);
//                console.log("Text: "+ tweet.text);
//
//            }

        },

        error:function (jqXHR, textStatus, errorThrown) {
            console.log("Twitter API error: "+textStatus);
            twitterData =  ERROR_FLAG;
            //alert('Sorry, there was a problem retrieving Twitter info.  '+TRY_AGAIN_MSG);
        }
    });
}

function callYQLAsync() {

    var query1 = 'select id, title.content, updated, summary.content, content.content from atom where url="http://www.rambo-mtb.org/?feed=atom" and category.term not in ("Trails Status")';
    var query2 = 'select id, title.content, updated, summary.content, content.content from atom where url="http://www.rambo-mtb.org/?feed=atom" and category.term = "Trails Status"';

    return $.ajax({
        url:'http://query.yahooapis.com/v1/public/yql',
        data:{
            q:"select * from yql.query.multi where queries='"+query1+";"+query2+"'",
            format:'json'
        },
        type:'GET',
        dataType:'jsonp',
        jsonp:'callback',
        timeout: TIMEOUT,
        jsonpCallback:'cbfunc',

        success:function (json) {
            //print("success");
            //print(Object.keys(json));
            console.log("done getting RSS/ATOM data");

            rssFeedData = json.query.results.results[0].entry;

//            console.log("**************************");
//            console.log("Count: "+ rssFeedData.query.count);

            //var feedItems = rssFeedData.query.results.results[0].entry;
            for (var i = 0; i < rssFeedData.length; i++) {
                rssFeedData[i].feedNum = i;
                rssFeedData[i].updatedDate = getFormattedDate(new Date(Date.parse(rssFeedData[i].updated)));
            }

            trailStatusData = json.query.results.results[1].entry;
            if (trailStatusData) {
                var rawDate = new Date(Date.parse(trailStatusData.updated));
                trailStatusData.updatedDate =  getFormattedDate(rawDate) + " @ " + getFormattedTime(rawDate);
            } else {
                // default if not found
                trailStatusData.title = "No recent updates.  The trails are probably open!";
                trailStatusData.updatedDate = null;
            }

            //console.log(trailStatusData);

        },

        error:function (jqXHR, textStatus, errorThrown) {
            console.log("Yahoo API error: "+textStatus);
            rssFeedData = ERROR_FLAG;
            trailStatusData = {};
            trailStatusData.title = ERROR_MSG_NO_DATA;
            trailStatusData.updatedDate = "N/A";
            //alert('Sorry, there was a problem retrieving Website News and Trail Status.  '+TRY_AGAIN_MSG);
        }
    });

}

function callGoogleCalAsync() {

    var now = (new Date()).toISOString();

    return $.ajax({
        url: 'https://www.googleapis.com/calendar/v3/calendars/96msjdsgp3tcs3jv8kegvd9rhc@group.calendar.google.com/events',

        data: {
            //fields: "items(description, end, location, start, summary, timeZone)",
            singleEvents: true,
            timeMin: now,
            key: "AIzaSyAZEASvv4Go1qssuljASB76T1HQPg_GgW8",
            orderBy: "startTime"
        },

        type: 'GET',
        timeout: TIMEOUT,
        dataType: 'jsonp',
        success: function(json) {
            console.log("done getting Google Calendar data");
            calendarData = json;
            generateEventFormattedDates(json.items);
            //console.log(JSON.stringify(json, null, '  '));
        },

        error:function (jqXHR, textStatus, errorThrown) {
            console.log("Google Calendar API error: "+textStatus);
            calendarData =  ERROR_FLAG;
            //alert('Sorry, there was a problem retrieving Google Calendar events.  '+TRY_AGAIN_MSG);
        }
    });
}

function getPageSelectorFromURL(urlObj) {
    // The pages we use to display our content are already in
    // the DOM. The id of the page we are going to write our
    // content into is specified in the hash before the '?'.
    return urlObj.hash.replace(/\?.*$/, "");
}
function processJQMListView($page, $content, options, urlObj) {
// Pages are lazily enhanced. We call page() on the page
    // element to make sure it is always enhanced before we
    // attempt to enhance the listview markup we just injected.
    // Subsequent calls to page() are ignored since a page/widget
    // can only be enhanced once.
    $page.page();

    // Enhance the listview we just injected.
    $content.find(":jqmData(role=listview)").listview();

    // We don't want the data-url of the page we just modified
    // to be the url that shows up in the browser's location field,
    // so set the dataUrl option to the URL for the category
    // we just loaded.
    options.dataUrl = urlObj.href;

    // Now call changePage() and tell it to switch to
    // the page we just modified.
    $.mobile.changePage($page, options);
}

function showTwitter( urlObj, options )
{
    var pageSelector = getPageSelectorFromURL(urlObj);


    var $page = $( pageSelector ),
        $header = $page.children( ":jqmData(role=header)" ),
        $content = $page.children( ":jqmData(role=content)" ),
        markup = twitterTemplate({things:twitterData});
    $header.find( "h1" ).html( "Tweets" );
    if (twitterData !== ERROR_FLAG) {
        $content.html( markup );
    } else {
        $content.html(ERROR_MSG_NO_DATA);
    }
    processJQMListView($page, $content, options, urlObj);


}

function showRSS( urlObj, options )
{
    var pageSelector = getPageSelectorFromURL(urlObj);

    var $page = $( pageSelector ),
        $header = $page.children( ":jqmData(role=header)" ),
        $content = $page.children( ":jqmData(role=content)" ),
        markup = rssTemplate({feedItems:rssFeedData});
    $header.find( "h1" ).html( "Website News" );

    if (rssFeedData !== ERROR_FLAG) {
        $content.html( markup );
    } else {
        $content.html(ERROR_MSG_NO_DATA);
    }

    // remove images
//    var images = $(".rsscontent img");
//    images.remove();
    processJQMListView($page, $content, options, urlObj);


}

function showRSSDetails( urlObj, options )
{
    var pageSelector = getPageSelectorFromURL(urlObj);

    var feedNum = urlObj.hash.replace( /.*feedNum=/, "" );
    //console.log("feedNum="+feedNum);

    var $page = $( pageSelector ),
        $header = $page.children( ":jqmData(role=header)" ),
        $content = $page.children( ":jqmData(role=content)" ),
        rssText = rssDetailTemplate({feedItem:rssFeedData[feedNum]});

    $header.find( "h1" ).html( "Details" );

    // hide img tag by renaming it before passing to jQuery to prevent jQuery
    // from evaluating it (full size image was showing up in network trace -- not quite sure why)
    var $markup = $(rssText.replace(/<img/gi,'<imgtemp'));

    // resize images to match mobile device using src.sencha.io service
    $markup.find('imgtemp').each(function() {
        var image = $(this);
        image.attr('src','http://src.sencha.io/-30/'+image.attr('src'));
        image.removeAttr('width');
        image.removeAttr('height');
    });

    var newMarkupText = $markup.html().replace(/<imgtemp/gi,'<img');
    $content.html(newMarkupText);

    // modify certain kinds of links
    $content.find('.rssDetailContent a').each(function() {
        var $link = $(this);
        var href = $link.attr('href');
        if ($link.find('img').length > 0 && href.indexOf('http://www.rambo-mtb.org') === 0) {
            // disable links to RAMBO-hosted images
            $link.removeAttr('href');
        } else if (href.indexOf('http://www.rambo-mtb.org') === 0) {
            // force RAMBO website links to open in new browser
            // add more websites in future (such as partner bike shops)
            $link.attr('target','_blank');
            $link.attr('rel','external');
        }
    });

    //  Email link to article
    $('#rssDetailEmail').bind("click", function(e) {
        var $link = $(this);
        var subject = $link.attr('data-subject');
        var url = $link.attr('data-url');
        $(this).attr('href','mailto:?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(url));
        return true;
    });

    // enhance buttons w/ jQuery Mobile style
    $('#rssDetailButtons').trigger('create');

    processJQMListView($page, $content, options, urlObj);


}

function showTrailStatus( urlObj, options )
{
    var pageSelector = getPageSelectorFromURL(urlObj);

    var $page = $( pageSelector ),
        $header = $page.children( ":jqmData(role=header)" ),
        $content = $page.children( ":jqmData(role=content)" ),
        markup = trailStatusTemplate({status:trailStatusData});
    $header.find( "h1" ).html( "Trail Status" );
    $content.html( markup );
    processJQMListView($page, $content, options, urlObj);


}

function showLocations( urlObj, options )
{
    var pageSelector = getPageSelectorFromURL(urlObj);

    var $page = $( pageSelector );
    options.dataUrl = urlObj.href;

    // Now call changePage() and tell it to switch to
    // the page we just modified.
    $.mobile.changePage($page, options);


}

function showCalendar( urlObj, options )
{
    var pageSelector = getPageSelectorFromURL(urlObj);


    var $page = $( pageSelector ),
        $header = $page.children( ":jqmData(role=header)" ),
        $content = $page.children( ":jqmData(role=content)" ),
        markup = calendarTemplate({events:calendarData.items});
    $header.find( "h1" ).html( "Calendar" );
    if (calendarData !== ERROR_FLAG) {
        $content.html( markup );
    } else {
        $content.html(ERROR_MSG_NO_DATA);
    }

    processJQMListView($page, $content, options, urlObj);


}
