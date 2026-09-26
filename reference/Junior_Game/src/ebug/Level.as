/**
 * @author sbbc231
 */


class ebug.Level{
	public var id:Number;
	public var name:String;
	public var next:String;
	public var rows:Number;
	public var cols:Number;
	public var tiles:Array;
	public var goals:Array;
	public var levelDataGeometry:Array;
	public var levelDataEntities:Array; 
	var bodyLevel : Boolean;
	
	/*
	 *	When loading a level, placing unique items (like player start) here 
	 *	helps us to be sure that there aren't conflicts (eg two player starts)	
	 *
	 *	Each item should indexed by it's Constants value and should contain a Vector3 pointing to the location of the item.
	 */	
	public var uniqueItems:Array;
	
	function Level() {
			id = 0;
			name = "";
			next = "none";
			rows = 0;
			cols = 0;
			tiles = new Array();
			levelDataGeometry = new Array();
			levelDataEntities = new Array();
			uniqueItems = new Array();
			goals = new Array();
			bodyLevel = false;			
	}
}