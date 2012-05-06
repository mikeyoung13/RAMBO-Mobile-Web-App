var twitterData = null;
var calendarData = null;
var categoryData = {
    animals: {
        name: "Animals",
        description: "All your favorites from aardvarks to zebras.",
        items: [
            {
                name: "Pets"
            },
            {
                name: "Farm Animals"
            },
            {
                name: "Wild Animals"
            }
        ]
    },
    colors: {
        name: "Colors",
        description: "Fresh colors from the magic rainbow.",
        items: [
            {
                name: "Blue"
            },
            {
                name: "Green"
            },
            {
                name: "Orange"
            },
            {
                name: "Purple"
            },
            {
                name: "Red"
            },
            {
                name: "Yellow"
            },
            {
                name: "Violet"
            }
        ]
    },
    vehicles: {
        name: "Vehicles",
        description: "Everything from cars to planes.",
        items: [
            {
                name: "Cars"
            },
            {
                name: "Planes"
            },
            {
                name: "Construction"
            }
        ]
    }
};
var twitterTemplate = null;
var calendarTemplate = null;

// Load the data for a specific category, based on
// the URL passed in. Generate markup for the items in the
// category, inject it into an embedded page, and then make
// that page the current active page.
function showCategory( urlObj, options )
{
    var categoryName = urlObj.hash.replace( /.*category=/, "" ),

    // Get the object that represents the category we
    // are interested in. Note, that at this point we could
    // instead fire off an ajax request to fetch the data, but
    // for the purposes of this sample, it's already in memory.
        category = categoryData[ categoryName ],

    // The pages we use to display our content are already in
    // the DOM. The id of the page we are going to write our
    // content into is specified in the hash before the '?'.
        pageSelector = urlObj.hash.replace( /\?.*$/, "" );

    if ( category ) {
        // Get the page we are going to dump our content into.
        var $page = $( pageSelector ),

        // Get the header for the page.
            $header = $page.children( ":jqmData(role=header)" ),

        // Get the content area element for the page.
            $content = $page.children( ":jqmData(role=content)" ),

        // The markup we are going to inject into the content
        // area of the page.
            markup = "<p>" + category.description + "</p><ul data-role='listview' data-inset='true'>",

        // The array of items for this category.
            cItems = category.items,

        // The number of items in the category.
            numItems = cItems.length;

        // Generate a list item for each item in the category
        // and add it to our markup.
        for ( var i = 0; i < numItems; i++ ) {
            markup += "<li>" + cItems[i].name + "</li>";
        }
        markup += "</ul>";

        // Find the h1 element in our header and inject the name of
        // the category into it.
        $header.find( "h1" ).html( category.name );

        // Inject the category items markup into the content element.
        $content.html( markup );

        // Pages are lazily enhanced. We call page() on the page
        // element to make sure it is always enhanced before we
        // attempt to enhance the listview markup we just injected.
        // Subsequent calls to page() are ignored since a page/widget
        // can only be enhanced once.
        $page.page();

        // Enhance the listview we just injected.
        $content.find( ":jqmData(role=listview)" ).listview();

        // We don't want the data-url of the page we just modified
        // to be the url that shows up in the browser's location field,
        // so set the dataUrl option to the URL for the category
        // we just loaded.
        options.dataUrl = urlObj.href;

        // Now call changePage() and tell it to switch to
        // the page we just modified.
        $.mobile.changePage( $page, options );
    }
}

function getFormattedDate(date) {
    console.log("Date to string",date.toDateString());
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

function generateEventFormattedDates(events) {
    for (var i = 0; i < events.length; i++) {
        var event = events[i];
        if (event.start.date) {
            // Safari requires the full date
            event.formattedDate = getFormattedDate(new Date(event.start.date +"T00:00:00-04:00"));
        } else if (event.start.dateTime) {
            var startDT = new Date(event.start.dateTime);
            var endDT = new Date(event.end.dateTime);

            var startDate = getFormattedDate(startDT);
            var startTime = getFormattedTime(startDT);
            var endTime = getFormattedTime(endDT);

            event.formattedDate = startDate + " " + startTime + " - " + endTime;

        }
    }
}

$(document).ready(function() {

    twitterTemplate = Handlebars.compile($("#twitter-result-template").html());
    calendarTemplate = Handlebars.compile($("#calendar-result-template").html());

    Handlebars.registerHelper('dateformat', function(dateString) {
        var date = new Date(dateString);
        return date.toLocaleDateString() +" - " + date.toLocaleTimeString();
    });


    console.log("template compiled!");

});





$(document).bind('pagechange',function(event,data) {
        console.log("pagechange event!!!");
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
            categoryPath = /^#category-item/,
            twitterPath = /^#twitter/,
            calendarPath = /^#calendar/;
        if ( u.hash.search(categoryPath) !== -1 ) {
            // We're being asked to display the items for a specific category.
            // Call our internal method that builds the content for the category
            // on the fly based on our in-memory category data structure.
            showCategory( u, data.options );

            // Make sure to tell changePage() we've handled this call so it doesn't
            // have to do anything.
            e.preventDefault()
        } else if (u.hash.search(twitterPath) !== -1)  {
            showTwitter( u, data.options );
            e.preventDefault()

        } else if (u.hash.search(calendarPath) !== -1)  {
            showCalendar( u, data.options );
            e.preventDefault()

        }

    }
});

function getTwitter() {

    $.ajax({
        // the URL for the request
        url: 'https://api.twitter.com/1/statuses/user_timeline.json',

        // the data to send
        // (will be converted to a query string)
        data: {
            user_id: 263189907,
            screen_name: "rambomtb",
            count: 10,
            trim_user: 1
        },

        // whether this is a POST or GET request
        type: 'GET',

        // the type of data we expect back
        dataType: 'json',

        // code to run if the request succeeds;
        // the response is passed to the function
        success: function(json) {
            //print("success");
            //print(Object.keys(json));

            twitterData = json;
            //$.mobile.pageLoading(true);

            for (var i=0; i<json.length; i++) {
                var tweet = json[i];
                console.log("**************************");
                console.log("Date: "+ tweet.created_at);
                console.log("Text: "+ tweet.text);

            }

        },

        // code to run if the request fails;
        // the raw request and status codes are
        // passed to the function
        error: function(xhr, status) {
            alert('Sorry, there was a problem!');
        },

        // code to run regardless of success or failure
        complete: function(xhr, status) {
            //print("request is complete ");
        }
    });
}

function getGoogleCal() {

    var now = (new Date()).toISOString();

    $.ajax({
        // the URL for the request
        url: 'https://www.googleapis.com/calendar/v3/calendars/96msjdsgp3tcs3jv8kegvd9rhc@group.calendar.google.com/events',

        // the data to send
        // (will be converted to a query string)
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
            console.log(JSON.stringify(json, null, '  '));
        },

        // code to run if the request fails;
        // the raw request and status codes are
        // passed to the function
        error: function(xhr, status) {
            alert('Sorry, there was a problem!');
        },

        // code to run regardless of success or failure
        complete: function(xhr, status) {
            console.log("request is complete ");
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
    pageSelector = getPageSelectorFromURL(urlObj);


        var $page = $( pageSelector ),
        $header = $page.children( ":jqmData(role=header)" ),
        $content = $page.children( ":jqmData(role=content)" ),
        markup = twitterTemplate({things:twitterData});
        $header.find( "h1" ).html( "Twitter Feed" );
        $content.html( markup );
        processJQMListView($page, $content, options, urlObj);


}

function showCalendar( urlObj, options )
{
    pageSelector = getPageSelectorFromURL(urlObj);


    var $page = $( pageSelector ),
        $header = $page.children( ":jqmData(role=header)" ),
        $content = $page.children( ":jqmData(role=content)" ),
        markup = calendarTemplate({events:calendarData.items});
    $header.find( "h1" ).html( "RAMBO Events" );
    $content.html( markup );
    processJQMListView($page, $content, options, urlObj);


}
