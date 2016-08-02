//This holds all the utility functions/objects

//This gets the offset of the map's left side from the screen edge
function leftMapOffset() {
  return $("#mapBase").offset().left
}

//This gets the offset of the map's top side from the screen edge
function topMapOffset() {
  return $("#mapBase").offset().top
}

//Transforms a click to a label
function clickToLabel(clickX, clickY) {
  var labelX = (clickX / $("#mapBase").width())
  var labelY = (clickY / $("#mapBase").height())
  return {'x': labelX, 'y': labelY}
}

//This is the popover that appears over the 'Get Predictions' button
var predictPopover = {
  content: "Please give us your predictions for more documents (30 total)" +
    " before trying to get our predictions",
  placement: 'top',
  trigger: 'manual'
}
