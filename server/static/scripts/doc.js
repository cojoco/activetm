//This class holds the doc number, text and labels

function Document(number, text, labelX, labelY) {
  this.number = number //Document number, as given by the server
  this.id = 'doc' + number //ID of this document in the DOM
  this.text = text //Text of the document
  this.labelX = labelX //Label of the document for the horizontal axis
  this.labelY = labelY //Label of the document for the vertical axis
}

Document.prototype = {
  constructor: Document,

  //Creates a <p> element to stick in the DOM
  toParagraph: function toParagraph() {
    return $('p').attr('id', this.id)
                 .attr('class', 'listedDoc')
                 .text(this.text)
  },

  //Creates a Dot object from this document
  toDot: function toDot() {
    return new Dot(this.number, this.labelX * 100, this.labelY * 100)
  }
}
