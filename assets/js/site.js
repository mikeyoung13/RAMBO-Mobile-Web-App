var twitterData = null,
    calendarData = null,
    rssFeedData = null,
    trailStatusData = null;

var ERROR_FLAG = "error",
    ERROR_MSG = "Data unavailable - please tray again later";

var twitterTemplate = null,
    calendarTemplate = null,
    rssTemplate = null,
    rssDetailTemplate = null,
    trailStatusTemplate = null;

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
    for (var i = 0; i < events.length; i++) {
        var event = events[i];
        if (event.start.date) {
            // Safari and js-iso8601 require the full date
            event.formattedDate = getFormattedDate(new Date(Date.parse(event.start.date +"T00:00:00-04:00")));
        } else if (event.start.dateTime) {
            var startDT = new Date(Date.parse(event.start.dateTime));
            var endDT = new Date(Date.parse(event.end.dateTime));

            var startDate = getFormattedDate(startDT);
            var startTime = getFormattedTime(startDT);
            var endTime = getFormattedTime(endDT);

            event.formattedDate = startDate + ", " + startTime + " - " + endTime;

        }
    }
}

function fetchData(){

    $('#lastUpdateDT').html("Updating...");
    $.when(getRssFeedAsync(), getGoogleCalAsync(), getTwitterAsync())
        .then (function(){
            $.mobile.hidePageLoadingMsg();
            var currentDate = new Date();
            $('#lastUpdateDT').html(getFormattedDate(currentDate)+" @ "+getFormattedTime(currentDate));
        })
        .fail (function(){
            alert('One or more requests failed.' );
        });
}

$(document).ready(function() {

    // show spinner during AJAX requests
    jQuery.ajaxSetup({
        beforeSend: function() {
            $.mobile.showPageLoadingMsg();
        }
    });

    // get Data
    fetchData();

    // refresh button/link
    $('#refresh').bind("vclick", function() {
        fetchData();
        return false;
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
            calendarPath = /^#calendar/;
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
        }

    }
});

function getTwitterAsync() {

    return $.ajax({
        url: 'https://api.twitter.com/1/statuses/user_timeline.json',
        data: {
            user_id: 263189907,
            screen_name: "rambomtb",
            count: 10,
            trim_user: 1
        },
        type: 'GET',
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

        error: function(xhr, status) {
            twitterData =  ERROR_FLAG;
            alert('Sorry, there was a problem getting Twitter data');
        }
    });
}

function getRssFeedAsync() {

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

        error:function (xhr, status) {
            rssFeedData = ERROR_FLAG;
            trailStatusData = {};
            trailStatusData.title = ERROR_MSG;
            trailStatusData.updatedDate = "N/A";
            alert('Sorry, there was a problem getting Website News and Trail Status');
        }
    });

}

function getGoogleCalAsync() {

    var now = (new Date()).toISOString();

    return $.ajax({
        url: 'https://www.googleapis.com/calendar/v3/calendars/96msjdsgp3tcs3jv8kegvd9rhc@group.calendar.google.com/events',

        data: {
            fields: "items(description, end, location, start, summary)",
            singleEvents: true,
            timeMin: now,
            key: "AIzaSyAZEASvv4Go1qssuljASB76T1HQPg_GgW8",
            orderBy: "startTime"
        },

        type: 'GET',
        dataType: 'jsonp',
        success: function(json) {
            console.log("done getting Google Calendar data");
            calendarData = json;
            generateEventFormattedDates(json.items);
            //console.log(JSON.stringify(json, null, '  '));
        },

        error: function(xhr, status) {
            calendarData =  ERROR_FLAG;
            alert('Sorry, there was a problem getting Google Calendar data');
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
        $content.html(ERROR_MSG);
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
        $content.html(ERROR_MSG);
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
        markup = rssDetailTemplate({feedItem:rssFeedData[feedNum]});
    $header.find( "h1" ).html( "Details" );
    $content.html( markup );

    // resize images to match mobile device using src.sencha.io service
    $('div.rssDetailContent img').each(function() {
        var image = $(this);
        image.attr('src','http://src.sencha.io/-30/'+image.attr('src'));
        image.removeAttr('width');
        image.removeAttr('height');
    });

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
        $content.html(ERROR_MSG);
    }

    processJQMListView($page, $content, options, urlObj);


}
