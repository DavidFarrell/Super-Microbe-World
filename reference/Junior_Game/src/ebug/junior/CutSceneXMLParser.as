

class ebug.junior.CutSceneXMLParser {
	
	public var loading : Boolean = false;
	public var xmlURL: String;
	private var xml : XML;
	private var interval : Number;
	
	public var statements : Array;
	
	public function CutSceneXMLParser() {
		loading = false;
		xml = new XML();
		xml.ignoreWhite = true;
		xmlURL = "";
		
		statements = new Array();
	}
	
	public function loadXML(fileName : String) {
		xmlURL = fileName;
		xml.load(fileName);
		loading = true;
		interval = setInterval(this,"checkXMLLoaded", 40);
		xml.onLoad = function(success:Boolean):Void {
		};
		
	}
	
	public function checkXMLLoaded() {
		var nLoaded : Number = xml.getBytesLoaded();
		var nTotal : Number = xml.getBytesTotal();
		var percentage : Number = 0;
		if ( nTotal > 0 ) {
			percentage = nLoaded / nTotal * 100;
		}
		if (percentage == 100) {
			clearInterval(interval);
			parseXML();
		} 
	}
	
	public function parseXML()  {
		
		var rootNote : XMLNode = xml.firstChild;
		
		for ( var i : Number = 0; i < rootNote.childNodes.length; i++) {
			var statementNode : XMLNode = rootNote.childNodes[i];
			statements.push(statementNode.firstChild.nodeValue);
		}
		
		loading = false;
	}
	
}