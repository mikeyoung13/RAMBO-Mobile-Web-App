var twitterData = null;
var calendarData = null;
var rssFeedData = null;
var twitterTemplate = null;
var calendarTemplate = null;
var rssTemplate = null;
var rssDetailTemplate = null;

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

$(document).ready(function() {

    twitterTemplate = Handlebars.compile($("#twitter-result-template").html());
    calendarTemplate = Handlebars.compile($("#calendar-result-template").html());
    rssTemplate = Handlebars.compile($("#rss-result-template").html());
    rssDetailTemplate = Handlebars.compile($("#rss-detail-template").html());

    //console.log("templates compiled!");

    Handlebars.registerHelper('timeAgo', function(dateString) {
        var dateMS = Date.parse(dateString);
        var now =  (new Date()).getTime();
        return getTweetTime(now, dateMS);
    });




});

$(document).bind('pagechange',function(event,data) {
        //console.log("pagechange event!!!");
        if (twitterData === null) {
            //$.mobile.pageloading();
            //alert("loading twitter data!");
            getTwitter();
        }
        if (calendarData === null) {
            //$.mobile.pageloading();
            //alert("loading twitter data!");
            getGoogleCal();
        }
        if (rssFeedData === null) {
            //$.mobile.pageloading();
            //alert("loading twitter data!");
            getRssFeed();
        }

    }
);

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
        }

    }
});

function getTwitter() {

    $.ajax({
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
            //print("success");
            //print(Object.keys(json));

            twitterData = json;
            //$.mobile.pageLoading(true);

//            for (var i=0; i<json.length; i++) {
//                var tweet = json[i];
//                console.log("**************************");
//                console.log("Date: "+ tweet.created_at);
//                console.log("Text: "+ tweet.text);
//
//            }

        },

        error: function(xhr, status) {
            alert('Sorry, there was a problem getting Twitter data');
        },

        complete: function(xhr, status) {
            console.log("done getting Twitter data");
        }
    });
}

function getRssFeed() {

    $.ajax({
        url: 'http://query.yahooapis.com/v1/public/yql?q=select%20id%2C%20title.content%2C%20updated%2C%20summary.content%2C%20content.content%20from%20atom%20where%20url%3D%22http%3A%2F%2Fwww.rambo-mtb.org%2F%3Ffeed%3Datom%22%20and%20category.term%20not%20in%20(%22Trails%20Status%22)&format=json',
        type: 'GET',
        dataType: 'jsonp',

        success: function(json) {
            //print("success");
            //print(Object.keys(json));

            rssFeedData = json;
            //$.mobile.pageLoading(true);

//            console.log("**************************");
//            console.log("Count: "+ rssFeedData.query.count);

            var feedItems =  rssFeedData.query.results.entry;
            for (var i = 0; i < feedItems.length; i++) {
                feedItems[i].feedNum = i;
                feedItems[i].updatedDate = getFormattedDate(new Date(Date.parse(feedItems[i].updated)));
            }

        },

        error: function(xhr, status) {
            alert('Sorry, there was a problem getting RSS/ATOM data');
        },

        complete: function(xhr, status) {
            console.log("done getting RSS/ATOM data");
        }
    });
}

function getGoogleCal() {

    var now = (new Date()).toISOString();

    $.ajax({
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
            calendarData = json;
            generateEventFormattedDates(json.items);
            //console.log(JSON.stringify(json, null, '  '));
        },

        error: function(xhr, status) {
            alert('Sorry, there was a problem getting Google Calendar data');
        },

        complete: function(xhr, status) {
            console.log("done getting Google Calendar data");
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
        $content.html( markup );
        processJQMListView($page, $content, options, urlObj);


}

function showRSS( urlObj, options )
{
    var pageSelector = getPageSelectorFromURL(urlObj);

    var $page = $( pageSelector ),
        $header = $page.children( ":jqmData(role=header)" ),
        $content = $page.children( ":jqmData(role=content)" ),
        markup = rssTemplate({feedItems:rssFeedData.query.results.entry});
    $header.find( "h1" ).html( "Website News" );
    $content.html( markup );

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
        markup = rssDetailTemplate({feedItem:rssFeedData.query.results.entry[feedNum]});
    $header.find( "h1" ).html( "Details" );
    $content.html( markup );
//    var images = $(".rsscontent img");
//    images.remove();
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
    $content.html( markup );
    processJQMListView($page, $content, options, urlObj);


}
