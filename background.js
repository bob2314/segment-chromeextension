var trackedEvents = new Array();

function zeroPad(i) {
	if (i < 10) {
		i = "0" + i
	}
	return i;
}

function updateTrackedEventsForTab(tabId,port) {
	var sendEvents = [];
	
	for(var i=0;i<trackedEvents.length;i++) {
		if (trackedEvents[i].tabId == tabId) {
			sendEvents.push(trackedEvents[i]);
		}
	}
	
	port.postMessage({
		type: 'update',
		events: sendEvents
	});
}
function clearTrackedEventsForTab(tabId,port) {
	var newTrackedEvents = [];			
	for(var i=0;i<trackedEvents.length;i++) {
		if (trackedEvents[i].tabId != tabId) {
			newTrackedEvents.push(trackedEvents[i]);
		}
	}
	trackedEvents = newTrackedEvents;
}

chrome.extension.onConnect.addListener((port) => {
	port.onMessage.addListener((msg) => {
		var tabId = msg.tabId;
		if (msg.type == 'update') {
			updateTrackedEventsForTab(tabId,port);
		}
		else if (msg.type == 'clear') {
			clearTrackedEventsForTab(tabId,port);
			updateTrackedEventsForTab(tabId,port);
		}
	});
});

chrome.webRequest.onBeforeRequest.addListener(
	(details) => {
    // Fox segment domain update:
	// Request URL: https://api.dev-nova.foxtv.com/v1/t
	const base_uri = 'nova.foxtv'
    if (
      details.url.startsWith("https://api.segment.io/v1") ||
		  details.url.includes("nova.foxtv") ||
      details.url.includes(base_uri)
    ) {
      var postedString = String.fromCharCode.apply(
        null,
        new Uint8Array(details.requestBody.raw[0].bytes)
      );

      var rawEvent = JSON.parse(postedString);

      var today = new Date();

      var h = zeroPad(today.getHours());
      var m = zeroPad(today.getMinutes());
      var s = zeroPad(today.getSeconds());

      var event = {
        eventName: rawEvent.event,
        raw: postedString,
        trackedTime: h + ":" + m + ":" + s,
      };

      chrome.tabs.query(
        {
          active: true,
          currentWindow: true,
        },
        (tabs) => {
          var tab = tabs[0];

          event.hostName = tab.url;
          event.tabId = tab.id;

          /**
           * Check or valid domains
           * 1) api.segment.io/v1/t
           * 2) nova.foxtv.com/v1/1
           * 3) nova.foxtv.com/v1/p
           */
          if (details.url == "https://api.segment.io/v1/t" || details.url.includes('nova.foxtv') && details.url.includes('v1/t')) {
            event.type = "track";

            trackedEvents.unshift(event);
          } else if (details.url == "https://api.segment.io/v1/1" || details.url.includes('nova.foxtv') && details.url.includes('v1/1')) {
            event.eventName = "Identify";
            event.type = "identify";

            trackedEvents.unshift(event);
        } else if (details.url == "https://api.segment.io/v1/p" || details.url.includes('nova.foxtv') && details.url.includes('v1/p')) {
            event.eventName = "Page loaded";
            event.type = "pageLoad";

            trackedEvents.unshift(event);
          }
        }
      );
    }
  },
	{
	urls: [
		"https://*/*",
		"http://*/*"
	]},
	['blocking','requestBody']
);