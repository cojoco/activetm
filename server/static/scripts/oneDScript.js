$(document).ready(function() {
  $(".button").click(function() {
    $("#testDoc").animate({left: '+=100px',
                           top: '+=100px'})
  })

  // Get info on the line's position to use to place the documents
  var minX = Number($("#lineBase").attr("x1"))
  var maxX = Number($("#lineBase").attr("x2"))
  var lineY = Number($("#lineBase").attr("y1"))
})
