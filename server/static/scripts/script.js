//This holds the high-level logic of the server

$(document).ready(function() {
  /*This is just so I remember how to animate things
  $("#testDoc").animate({left: '+=100px',
                         top: '+=100px'})
  */

  //The base map object
  map = new MetadataMap()

  //We only want the spinning wheel to show when needed
  $("#waitContainer").hide()

  //This initializes the prediction popover so we can manually activate it later
  $("#predictButton").popover(predictPopover)

  //List docs mode when listButton is clicked
  $("#listButton").on('click', listButtonClicked)

  //Label docs mode when labelButton is clicked
  $("#labelButton").on('click', labelButtonClicked)

  //Assign a listener to handle the user wanting to get the model's predictions
  $("#predictForm").on('submit', makePredictions)

  //Assign an onclick handler to the map
  $("#mapBase").on('click', mapClickHandler)

  //Get a new uuid and needed document info if this is a new session
  if (Cookies.get('mdm_uuid') === undefined) {
    startNewSession()
  }
	//If this is an old session, just get needed document info
  else {
    resumeOldSession()
  }
})
