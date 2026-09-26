
/**
 * @author sbbc231
 */

class ebug.Tile {
	public var movie:String;
	public var sides:Array;
	public var rows:Number;
	public var cols:Number;
	public var id:Number;
	public var entity:Boolean;
	public var script:String;
	public var type:Number;
	
	function Tile() {
		sides = new Array();
		sides.push(0); // left 
		sides.push(0); // top
		sides.push(0); // right
		sides.push(0); // bottom
		
		rows = 1;
		cols = 1;
		
		entity = false;
		script = "";
	}
	
	
}