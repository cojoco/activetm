//This class holds the dot id, position and corresponding document number

function Dot(docNumber, posX, posY) {
  this.id = 'dot' + docNumber //ID of the dot in the DOM
  this.docNumber = docNumber //Number of the corresponding document
  this.posX = posX //X-position of the dot's center
  this.posY = posY //Y-position of the dot's center
}

Dot.prototype = {
  constructor: Dot,

  //Creates a SVG dot to stick on the map
  toSVG: function toSVG() {
    return $(svg('circle')).attr('id', this.id)
                           .attr('class', 'dot')
                           .attr('cx', this.posX + '%')
                           .attr('cy', this.posY + '%')
                           .attr('r', '2%')
                           .attr('stroke', 'gray')
                           .attr('stroke-width', 1)
                           .attr('fill', 'gray')
                           .attr('stroke-opacity', '0.2')
                           .attr('fill-opacity', '0.2')
  }
}

//Creates an SVG element in a way JQuery can work with it
function svg(tag) {
  return document.createElementNS('http://www.w3.org/2000/svg', tag)
}
