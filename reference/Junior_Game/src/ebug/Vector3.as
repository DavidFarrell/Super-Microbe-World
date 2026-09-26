/**
 * @author sbbc231
 */
import ebug.*;

class ebug.Vector3 {
	var x:Number;
	var y:Number;
	var z:Number;
	
	public static var RADIANS:Boolean = false;
	public static var DEGREES:Boolean = true;
	
	function Vector3(inX:Number, inY:Number, inZ:Number) {
		x = (!isNaN(inX))?inX:0;	
		y = (!isNaN(inY))?inY:0;	
		z = (!isNaN(inZ))?inZ:0;	
	}
	
	function toString():String {
		return "(" + x + "," + y + "," + z + ")";	
	}
	
	function add(vector:Vector3, precision:Number):Vector3 {
		var sum:Vector3 = new Vector3(x, y, z);
		sum.x += vector.x;
		sum.y += vector.y;
		sum.z += vector.z;
		sum.round(precision-1);
		return sum;
	}
	
	function round(precision:Number) {
		if (isNaN(precision)) {
			precision = 3;	
		}
		var factor:Number = Math.pow(10, precision);
		x = (Math.round(x * factor) / factor);
		y = (Math.round(y * factor) / factor);
		z = (Math.round(z * factor) / factor);		
	}
	
	function subtract(vector:Vector3):Vector3 {
		var sub:Vector3 = new Vector3(x, y, z);
		sub.x -= vector.x;
		sub.y -= vector.y;
		sub.z -= vector.z;
		return sub;
	}
	
	public function clone():Vector3 {
		return new Vector3(x, y, z);
	}
	
	public function equals(vector, precision:Number):Boolean {	
		if (isNaN(precision)) {
			precision = 1;	
		}
		
		var factor:Number = Math.pow(10, precision);
		x = (Math.round(x * factor) / factor);
	
		var equal:Boolean = false;
		if ( vector instanceof Vector3) {
			equal = ( x == vector.x && y == vector.y && z == vector.z );
			//equal = ( (Math.abs(x - vector.x) < 0.02) && (Math.abs(y - vector.y) < 0.02) && (Math.abs(z - vector.z) < 0.02));
		}
		return equal;
	}
	
	
	// total 'power' of the vectors
	// gives the area of triangle with sides made from these vectors
	/*
	 *		a x b = |	x	y	z	|
	 *				|	ax	ay	az	|
	 *				|	bx	by	bz	|
	 * Can multiply each diagonal to get value
	 * You do x starting at y in first vector
 	 * so  newX = (ay * bz) + (az * by)
 	 * and newY = (az * bx) + (ax * bz)
 	 * and newZ = (ax * by) + (bx * ay)
 	 *
 	 * can use to find the normal of two vectors / plane
 	 * can use to find axis for rotation
 	 * 
	 */
	 
	public function crossProduct(vector:Vector3):Vector3 {
		var product:Vector3 = new Vector3();
		product.x = (y * vector.z) - (z * vector.y);
		product.y = (z * vector.x) - (x * vector.z);
		product.z = (x * vector.y) - (y * vector.x);
		
		return product;
	}
	
	/*
	 *	Returns magnitude of projection.
	 *
	 *	Is used to find angle between two vectors.
	 *  
	 *  for vector v	 	v . v is the square of its length.
	 *  for vectors v, v'	v . v' = |v||v'|cos(theta)
	 *
	 *  If we use unit vectors, v . v' gives the cosine of theta
	 *	so the angle = arccos( v . v' ) (in radians)
	 *  If angle < 90 then two vectors don't face each other.
	 *
	 *  Also used to project vector a onto vector b
	 *  scalar projection of b onto a is |b|cos(theta)
	 *  So:   	proj.x = ( dp / (b.x*b.x + b.y*b.y) ) * b.x;
	 *			proj.y = ( dp / (b.x*b.x + b.y*b.y) ) * b.y;
	 *
	 *	(note that "(b.x*b.x + b.y*b.y)" is just |b| squared
	 */
	public function dotProduct(vector:Vector3):Number {
		var product:Number;
		product = (x * vector.x) + (y * vector.y) + (z * vector.z);
		return product;
	}
	
	// hack for 2d at present
	public function getNormal():Vector3{
		return this.crossProduct(this.add(new Vector3(0,0,10))).unitVector();			
	}
	
	/*
	 *  Project vector THIS VECTOR (a) onto vector b
	 *  scalar projection of b onto a is |b|cos(theta)
	 *  So:   	proj.x = ( dp / (b.x*b.x + b.y*b.y) ) * b.x;
	 *			proj.y = ( dp / (b.x*b.x + b.y*b.y) ) * b.y;
	 *
	 *	(note that "(b.x*b.x + b.y*b.y)" is just |b| squared
	 *	 and that dp = dot prot of this and b)
	 *
	 *  If b is a unit vector, this simplifies to:
	 *
	 *	proj.x = dp*b.x;
	 * 	proj.y = dp*b.y; 
	 */
	public function project(vector:Vector3) {
		var proj:Vector3 = new Vector3();
		vector = vector.unitVector();
		var dp:Number = dotProduct(vector);
		if (dp == 0) { // no length! Also no good way to recover :-(
			return this.clone();
		} else {
			proj.x = dp * vector.x;
			proj.y = dp * vector.y;
			return proj;
		}
	}
	
	public function angleBetween(vector:Vector3, degrees:Boolean):Number {
		degrees = (degrees != undefined)?degrees:true;
		if (degrees) {
			return Math.acos(dotProduct(vector) / (getLength() * vector.getLength())  ) / (Math.PI/180);
		} else {
			return Math.acos(dotProduct(vector) / (getLength() * vector.getLength())  );
		}
	}
	
	public function multiply(factor:Number):Vector3 {
		var product:Vector3 = new Vector3();
		product.x = factor * x;
		product.y = factor * y;
		product.z = factor * z;		
		return product;
	}
	
	public function unitVector():Vector3 {
		var unit:Vector3 = new Vector3();
		var length = getLength();
		unit.x = x / length;
		unit.y = y / length;
		unit.z = z / length;
		return unit;
	}
	
	/*
	 * Pythagoras would be m =  sqrt(x*x + y*y)
	 * 3D is same with z too
	 */
	public function getLength():Number {
		return Math.sqrt( dotProduct(this) );
	}
}