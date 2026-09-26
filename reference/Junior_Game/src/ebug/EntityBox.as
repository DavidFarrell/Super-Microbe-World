/**
 * @author sbbc231
 */
import ebug.*;

class ebug.EntityBox extends Entity {
	var width:Number;
	var height:Number;
	
	public function EntityBox(origin:Vector3, w:Number, h:Number, id : Number) {
		super(origin, Entity.TYPE_BOX);
		width = (isNaN(w))?10:w;
		height = (isNaN(h))?10:h;
		
		setUpFaces();
		setUpCollisionVectors();
		setUpNormals();
		setUpCentrePoint();
		
		bottomRightOffset = new Vector3(width, height, 0);
	}
	
	/*
	 * Each face has a position and a direction magnitude.
	 */
	private function setUpFaces():Void {
		// TL -> TR
		faces[0] = [ new Vector3(0,0,0),new Vector3(width, 0, 0)];
		// TR -> BR
		faces[1] = [ new Vector3(width, 0, 0), new Vector3(0, height, 0)];
		// BR -> BL
		faces[2] = [ new Vector3(width, height, 0), new Vector3(-width, 0, 0)];		
		// BL -> TL
		faces[3] = [ new Vector3(0, height, 0), new Vector3(0, -height, 0)];
	}
	
	private function setUpCollisionVectors():Void {
		for (var i = 0; i < faces.length; i++) {
			collisionVectors[i] = faces[(i+1)%4][0].subtract(faces[i][0]).unitVector();
		}
	}
	
	/*
	 *  The normals are unit vectors perpendicular to each face. 
	 *	They don't contain magnitute.
	 *  Can use standard cross product providing both vectors aren't exactly same, so add a bit to z direction because
	 *  a 2D Box face doesn't use z.
	 */
	private function setUpNormals():Void {
		for (var i:Number = 0; i < collisionVectors.length; i++) {
			normals[i] = collisionVectors[i].getNormal();	
		}
	}
	
	private function setUpCentrePoint():Void {
		this.centreOffset = faces[2][0].multiply(0.5);
	}	
}