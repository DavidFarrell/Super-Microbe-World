/**
 * @author sbbc231
 * Entities are physics items that can be colided with.
 * Each game object that is controlled by the Particle System will have an Entity associated with it.
 * 
 * If an entity is static, it does not itself move.  There is the option of precalculating collision axes etc...
 */
import ebug.*;
import ebug.junior.*;

class ebug.Entity {
	public var isDynamic : Boolean;
	
	// position has universal coords, not local
	public var position:Vector3;
	public var previousPosition:Vector3;
	/*
	 *	On collisions we need to know where the centre point of this object is.  
	 *	Storing the centreOffset allows us to do this with less calculations.
	 */
	public var centreOffset:Vector3;
	public var centre:Vector3;
	
	public var width : Number;
	public var height : Number;
	
	public var theParent : GameEntity;
	
	// identifies bottom right corner for world boundary calculations
	public var bottomRightOffset:Vector3;
	
	/*
	 *	isColiding is used to help figure out if any action is required beyond physics when two items colide.
	 */
	public var isColiding:Boolean;
	
	// typically the normals are the axes to project onto - but you don't really project onto an axis, you project onto the
	// vector perpendicular to the tangent - which is the normalised direction vector of the face itself. 
	public var collisionVectors:Array;
	public var type:Number;
	// each cell in faces array contains a position DISPLACEMENT (from origin) and a direction
	public var faces:Array;
	public var normals:Array;
	public var force:Vector3;
	
	public static var TYPE_BOX:Number = 0;
	public static var TYPE_BALL:Number = 1;
	
	public var gravityExcempt:Boolean;
	public var physicsExcempt:Boolean;
	
	public function Entity(origin:Vector3, shape:Number, id : Number) {
		position = (origin == undefined)?new Vector3():origin.clone();
		collisionVectors = new Array();
		type = (isNaN(shape))?Entity.TYPE_BALL: shape;
		faces = new Array();
		normals = new Array();
		force = new Vector3();
		previousPosition = position.clone();
		isColiding = false;
		gravityExcempt = false;
		physicsExcempt = false;
		bottomRightOffset = new Vector3();
	}

	public function toString():String {
		var returnString:String = "Physics Entity at: " + position + ".  Prev pos: + " + previousPosition +".\n";
		returnString += "	- Faces:\n";
		for (var i:Number = 0; i < faces.length; i++) {
			returnString += "	        position"+i+": "+ faces[i][0] +"	direction"+i+": "+faces[i][1]+"\n";
		}
		returnString += "  - Normals:\n";
		for (var i:Number = 0; i < normals.length; i++) {
			returnString += "	        normal"+i+": "+normals[i]+"\n";
		}
		returnString += "  - Collision Vectors:\n";
		for (var i:Number = 0; i < collisionVectors.length; i++) {
			returnString += "	        direction"+i+": "+collisionVectors[i]+"\n";
		}
		return returnString;			
	}
	
	public function teleport(newPos:Vector3):Void {
		previousPosition.x = position.x;
		previousPosition.y = position.y;
		previousPosition.z = position.z;
		
		position.x = newPos.x;
		position.y = newPos.y;
		position.z = newPos.z;
	}
}