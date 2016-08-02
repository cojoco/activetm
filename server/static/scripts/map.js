//This class holds the map itself

function MetadataMap() {
  this.documents = {}
  this.dots = {}
}

MetadataMap.prototype = {
  constructor: MetadataMap,

  //Getters and Setters
  addDocument: function addDocument(doc) {
    this.documents[doc.number] = doc
  },
  removeDocument: function removeDocument(doc) {
    delete this.documents[doc.number]
  },
  addDot: function addDot(dot) {
    this.dots[dot.id] = dot
    $("#mapBase").append(dot.toSVG())
  },
  removeDot: function removeDot(dot) {
    delete this.dots[dot.id]
    $("#"+dot.id).remove()
  }
}
