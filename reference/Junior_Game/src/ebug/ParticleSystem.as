import ebug.*;
import ebug.junior.*;
import mx.data.encoders.Num;

class ebug.ParticleSystem {
	/*
	 *	totalForce is not used at present but can be used as a very naive trigger for lowering timeInterval 
	 *	if the physics system gets unstable.
	 */
	var totalForce:Number;
	
	/*
	 *	Contains pointers to entities from the entities array in the main game.
	 *
	 *	Every item that is placed in the dynamicEntities array is considered 'live' and will have forces applied to it.
	 *	Each cell in the array is itself an array.  
	 *	See comments at top of PlatformGame for index values in this array.
	 */
	var dynamicEntities:Array;
	
	/*
	 *	Collision detection is currently done on axis aligned bounding boxes although little needs done to convert
	 *	to a seperating axis model which doesn't require rectangles.
	 *	Because the calculations are slower than ball collision models the system creates a circle bounding area for each 
	 *	object that is used on first pass to save calculations.
	 */	
	var dynamicBoundingBalls:Array;
	
	/*
	 *	Static entities do not receive forces or position updates but do have bounds that stop dynamic Entities from passing through.
	 *	Static entities should be used for things like platforms and anything else immovable.
	 */
	var staticEntities:Array;
	var staticBoundingBalls:Array;
	
	/*
	 *	maxChange allows us to control how fast Entities can move.
	 *	If Entities move > 50% of another Entity's width / height, we can easily get situations where clips 
	 *	appear to jump to the wrong side of an object on collision.
	 */
	var maxChange:Vector3;
	var constrainSpeeds:Boolean;
	
	var numEntities : Number;
	
	/*
	 *	Drag is not used like friction.  
	 *	It does not scale exponentially with speed but it does dampen forces so that objects don't move forever.
	 *	It stops things sliding too much and helps prevent objects connected via sticks from spinning forever.
	 *	As drag approaches 1, drag reduces.
	 *	Anything over 1 and drag will ADD to forces.
	 */
	var drag:Number;
	
	/*
	 *	Sticks specify a distance between two particles that is enforced like a very tight spring.
	 *  With sticks between the four corners of a rectangle and across the two diagonals, the 
	 *	particls make a larger shape.  
	 *	We can use this for rigid body dynamics (rag dolls)
	 *	Each cell in the array contains the information about one stick.
	 *	The static vars STICK_FIRST, STICK_SECOND and STICK_RESTLENGTH specify the particles and
	 *	required distance between them.
	 */
	var stickConstraints:Array;
	public static var STICK_FIRST : Number = 0;
	public static var STICK_SECOND : Number = 1;
	public static var STICK_RESTLENGTH : Number = 2;
	
	/*
	 *	Continual pull towards floor (+ve Y) for dynamic Entities.
	 *	Entities can be made to ignore gravity by setting their gravityExcempt boolean to true.
	 */
	var gravity:Vector3;
	
	/*
	 *	Specifies how long the system thinks it is spending between calculations.
	 *	Larger numbers have two effects.
	 *		1:	Objects move further as more time is deemed to have passed between iterations.
	 *		2:	The system is less accurate as objects may move through each other at high speeds. 
	 *			This does happen at small intervals too but requires higher forces to occur.  
	 *			It's all relative though :-)
	 */
	var timeInterval:Number;
	
	/*
	 *	This number specifies how many attempts to fix 'problems' the system tries per call.
	 *	A lower number (with relatively high velocities) makes objects bounce a little because the system 
	 *	can't reduce the 'error' properly.
	 *	This isn't always a bad thing though!  It allows for contacts to feel somewhat sping based.
	 *	Higher iterations lead to greater accuracy but at a significant performance cost.
	 *	This could be used as a way to make the game perform better on old machines (but of course the
	 *	games might behave wierd).
	 */
	public var numIterations:Number;
	
	/*
	 *	These vars (in pixels) specify the screen bounds in which objects much stay.
	 */
	var worldMin:Vector3;
	var worldMax:Vector3;
	
	/*
	 *	Used to identify axis of penetration in the case of a collision.
	 */
	public static var AXIS_X:Number = 1;
	public static var AXIS_Y:Number = -1;
		
	/*
	 *	These should be removed before publication.  
	 *	These allow tests and tracking of vars based on whether the system is in debug mode or not.
	 */
	var debug:Boolean;
	var debugNumber:Number;
	var fpsMillis:Number;
	var fps:Number;
	var parent : PlatformGame;
	
	/*
	 * Indexed by
	 * 		[dynamic array id][dynamic or static][id of target] = true (if it is excempt) 
	 */
	 public var excemptionMatrix : Array;
	 public static var DYNAMIC : Number = 0;
	 public static var STATIC : Number = 1;
	
	 
	 
	// this array holds a representation of the level geometry (rows, cols)
	// each cell is either NaN or is an index into static particles array
	public var levelTileArray : Array;
	
	// each time step, insert collided entities here so that each does not trigger a new collision with the other.
	public var hasCollided : Array;
	 
	function ParticleSystem(deltaT:Number, its:Number, wMin:Vector3, wMax:Vector3, grav:Vector3, damp:Number, limit:Vector3, cs:Boolean) {
		// remove these before publication
		debug = false;
		debugNumber = 0;
		fpsMillis = 0;
		fps = 0;
		excemptionMatrix = new Array();
		
		numEntities = 0;
		
		staticEntities = new Array();
		staticBoundingBalls = new Array();
		dynamicEntities = new Array();
		dynamicBoundingBalls = new Array();
		stickConstraints = new Array();
		
		//trace (deltaT + ", " + its + ", " + cs);
			
		timeInterval =  ((isNaN(deltaT))?50:deltaT) / 1000 ;  
		numIterations = (isNaN(its))?4:its;
		worldMin = (wMin == undefined)?new Vector3(0, 0, 0):wMin;
		worldMax = (wMax == undefined)?new Vector3(800,450,0):wMax;
		gravity = (grav == undefined)?new Vector2(0,10,0):grav;	
		drag = (isNaN(damp))?0.95:damp;
		maxChange = (limit == undefined)?new Vector3(9999999,9999999,0):limit;
		constrainSpeeds = (cs == undefined)?true:cs;

		//trace("num its: " + numIterations);
		
		// this array will store a representation of the level.
		// each cell will contain the index into the staticEntity array for the tile in that cell.
		var rows = (worldMax.y / 50);
		//trace("rows: " + rows);
		var cols = (worldMax.x / 50);
		//trace("cols: " + cols + worldMax);
		hasCollided = new Array();
		levelTileArray = new Array();
		
		if (isNaN(rows)) rows = 0;
		if (isNaN(cols)) cols = 0;
		
		for (var row: Number = 0; row < rows; row++) {
			levelTileArray[row] = new Array();
			for ( var col: Number = 0; col < cols ; col++) {
				levelTileArray[row][col] = " ";
			}
		}
	}

	/**
	 *	Creates an Entity that is rectangular.
	 */
	function createBoxParticle(position:Vector3, clip:MovieClip, dynamicEntity:Boolean, force:Vector3, gravityExcempt:Boolean, maxChangeExcempt:Boolean, forceSize : Vector3) : Number {
		var index : Number = null;
		if ( (clip instanceof MovieClip) ) {
			var width : Number = clip._width;
			var height : Number = clip._height;
			// forceSize here refers to forcing the size of the bounding box, not the size of a force on the object
			if ( forceSize != null ) {
				width = forceSize.x;
				height = forceSize.y;	
			}
			var boxEntity:EntityBox = new EntityBox(position, width, height, numEntities++);
			boxEntity.force = ((force != undefined)?force:new Vector3(0,0,0));	
			
			if (gravityExcempt) {
				boxEntity.gravityExcempt = true;	
			}
			boxEntity.isDynamic = dynamicEntity;
			clip._x = position.x;
			clip._y = position.y;
			
			if (dynamicEntity) {
				dynamicEntities.push(boxEntity);
				dynamicBoundingBalls.push( Math.round(Math.sqrt(width*width + height*height)/2) );
				index = dynamicEntities.length -1;
				excemptionMatrix[index] = new Array();
				excemptionMatrix[index][ParticleSystem.DYNAMIC] = new Array();
				excemptionMatrix[index][ParticleSystem.STATIC] = new Array();				
			} else {
				staticEntities.push(boxEntity);	
				staticBoundingBalls.push( Math.round(Math.sqrt(width*width + height*height)/2) );
				index = staticEntities.length - 1;
				
				levelTileArray[(position.y/50)][(position.x/50)] = index;
			}
			if (!maxChangeExcempt) {
				if (Math.ceil(width/2) < maxChange.x ) {
					//trace ("changed max due to x: "+clip._name); 
					
					maxChange.x = width/2;
				//	trace (maxChange);
				}	
				if (Math.ceil(height/2) < maxChange.y ) {
					//trace ("changed max due to y"+clip._name);
					maxChange.y = height/2;
					//trace (maxChange);	
				}
			}
		} else {
//			trace("unknown item " + clip);	
		}
	
		return index;
	}
	
	/**
	 * When creating a stick, send the index vars of the two dynamic entities
	 * Can't create a stick with a static entity.
	 */
	function createStick(first:Number, second:Number, restLength) {
		stickConstraints.push( [first, second, restLength] );
	}
	
	function createStickFromEntities(first : Entity, second : Entity, restLength) {
		var firstIndex : Number;
		var secondIndex : Number;
		for (var index : Number = 0; index < dynamicEntities.length; index ++) {
			if ( dynamicEntities[index] == first ) {
				firstIndex = index;
			}
			if ( dynamicEntities[index] == second ) {
				secondIndex = index;
			}
		}
		if ( firstIndex >= 0 && secondIndex >= 0) {
			//trace ("foundem:" + firstIndex + ", " + secondIndex);
			createStick(firstIndex, secondIndex, restLength); 
		} else {
			//trace ("nope:" + firstIndex + ", " + secondIndex);
		}
	}
	
	
	/**
	 *	Only used for debug.
	 */
	function drawCircle (x,y,r, clip) {     
		var c1=r*(Math.SQRT2-1);     
		var c2=r*Math.SQRT2/2;     
		clip.moveTo(x+r,y);     
		clip.curveTo(x+r,y+c1,x+c2,y+c2);     
		clip.curveTo(x+c1,y+r,x,y+r);     
		clip.curveTo(x-c1,y+r,x-c2,y+c2);     
		clip.curveTo(x-r,y+c1,x-r,y);     
		clip.curveTo(x-r,y-c1,x-c2,y-c2);     
		clip.curveTo(x-c1,y-r,x,y-r);     
		clip.curveTo(x+c1,y-r,x+c2,y-c2);     
		clip.curveTo(x+r,y-c1,x+r,y); 
	}
	
	/**
	 *	Calls functions requied for physics implementation.
	 *	Run this with an interval from main class.
	 */
	function timeStep() : Void
	{ 
	//	var start = getTimer();
		hasCollided = new Array();
		//trace ("time step with : " + this.numIterations + " iterations");
		accumulateForces();
		verlet();
	//	var mid = getTimer();
		satisfyConstraints();
		//var end = getTimer();
		//trace (start + " - " + mid + "(" + (mid - start) + ") - " + end + "(" + (end - start) +")");
		/*if ( (getTimer() - debugNumber) > 1000 ) {
			debugNumber = getTimer();
			_root["partcle"].text = "Length:" + dynamicEntities.length + " [" + dynamicEntities[ (dynamicEntities.length -1) ] + "]";
		}*/
	}
	
	/**
	 *	Using the Verlet method (  Verlet, L. "Computer experiments on classical fluids. I. Thermodynamical properties of Lennard-Jones molecules", Phys. Rev., 159, 98-103 (1967). )
	 *	the system doesn't track velocity but instead infers velocity from previous position and current position.
	 *	Because of this, velocity is less likely to 'break' the physics implementation.
	 *	This implementation is based on this paper: http://www.teknikus.dk/tj/gdc2001.htm
	 *	by Thomas Jakobsen (who did physics for Hitman).  
	 *	The whole particle system is based on that really.  
	 *	This implements about half the paper and skips on cloth and collision detection.
	 *	The collision stuff in this comes mainly from the programmers behind 'N' http://www.harveycartel.org/metanet/tutorials/tutorialA.html
	 */
	function verlet() {
		
		for (var i:Number = 0; i < dynamicEntities.length; i++) {
			if ( dynamicEntities[i] != null) {
				var currentEntity:Entity = dynamicEntities[i];
				if ( !currentEntity.physicsExcempt) {
					var tempPos:Vector3 = currentEntity.position.clone();
					var change:Vector3 = (currentEntity.position.subtract( currentEntity.previousPosition )).multiply(drag);
					var forceChange:Vector3 = currentEntity.force.multiply(timeInterval*timeInterval);
					
					// add velocity
					var newPos:Vector3 = currentEntity.position.add(change);
					// add forces
					newPos = newPos.add( forceChange )  ;
					
					/* 
					 * 	Because the clips (and thus Entities) are small relative to the forces, it is easily possible
					 *	penetrate more than 50% of the way through a clip.
					 *	When this happens, you get forced (by collision routines) to the other side of the box. 
					 *	To 'fix' this, we dampen change.
					 */
					if (constrainSpeeds) {
						var finalChange = newPos.subtract(tempPos);
						if ( Math.abs(finalChange.x) > maxChange.x ) {
							newPos.x = (finalChange.x < 0)?tempPos.x - maxChange.x:tempPos.x + maxChange.x;
							finalChange = newPos.subtract(tempPos);
						}
						if ( Math.abs(finalChange.y) > maxChange.y ) {
							newPos.y = (finalChange.y < 0)?tempPos.y - maxChange.y:tempPos.y + maxChange.y;
						}	
					}
					currentEntity.position = newPos;
					currentEntity.previousPosition = tempPos;
					totalForce += change.getLength();	
					currentEntity.force.x = currentEntity.force.y = currentEntity.force.z = 0;
				}
			}
		}
	}
	
	/**
	 *	Integration.
	 *	All forces are accumulated into one Vector which is applied to the Entity's current position.
	 */
	function accumulateForces() {	
		for (var i:Number = 0; i < dynamicEntities.length; i++) {
			if ( dynamicEntities[i] != null) {
				var currentEntity:Entity = dynamicEntities[i];
				var newForce:Vector3 = new Vector3();
				if ( dynamicEntities[i].gravityExcempt == false ) {
					newForce = currentEntity.force.add(gravity);
				}
				
				// apply friction
				if ( Math.abs( newForce.x ) > 10 ) {
					newForce.x = .9 * newForce.x;
				} else {
					newForce.x = .8 * newForce.x;
				}
				currentEntity.force = newForce;
			}
		}
	}
	
	/**
	 *	As per the Jacobson paper, instead of 'solving' the equations in one big calculation,
	 *	equations are instead solved at a local level.
	 *	So, items are moved due to being outwith their stick constraints then moved due to being in 
	 *	a collision state, then finally moved due to being outwith world boundaries.
	 *	The reason this 'works' well is that multiple iterations are performed.
	 *	As iterations are performed, the system trends towards lower and lower error levels.
	 *
	 *	A constraint can be broken by a later one.  
	 *  So the later a constraint is satisfied, the higher its priority.  
	 */
	function satisfyConstraints() {
		for (var i:Number = 0; i < numIterations; i++) {
			// satisfy collissions 
			// added support for any index to be null, meaning remove the item from consideration.
			for (var firstIndex:Number = 0; firstIndex < dynamicEntities.length; firstIndex++) {
				if ( dynamicEntities [ firstIndex ] != null ) {
					if ( hasCollided[firstIndex] == undefined || hasCollided[firstIndex] == null) {
						hasCollided[firstIndex] = new Array();
					}
					
					/*
					 * Just now we compare each dynamic entity to all other entities, static and dynamic.
					 * It would be much more efficient to use the grid array that is stored in the world data
					 * to filter these to neighbours only.
					 */
					var currentEntity:Entity = dynamicEntities[firstIndex];
					
					if ( currentEntity.theParent.isOnScreen || currentEntity.physicsExcempt) {
						currentEntity.isColiding = false;
						// set up centre points for future use
						currentEntity.centre = currentEntity.position.add(currentEntity.centreOffset);
						
						/*
						 *	We compare 'currrentEntity' - which is a dynamicEntity first against all other dynamic entities, then against static entities.
						 *	In this order, it is more important that Entities don't penetrate static Entities than dynamic ones.
						 *	In the collision tests, a bounding ball test is first carried out because it is fast.
						 *  Only if Entities collide with the ball method do we test for more accurate collisions.
						 */
						for (var secondIndex:Number = 0; secondIndex < dynamicEntities.length; secondIndex++) {
							// ignore second index if it's a null particle
							if ( dynamicEntities[secondIndex] != null ) {
								
								// if there has already been a detected collision for these two entities, search no further
								// always stored smaller first...
								var smallerIndex : Number = (firstIndex < secondIndex)?firstIndex:secondIndex;
								var largerIndex : Number = (firstIndex > secondIndex)?firstIndex:secondIndex;
									
								
								if ( (firstIndex != secondIndex) && 
									( hasCollided[smallerIndex][largerIndex] != true ) &&
									( excemptionMatrix[firstIndex][ParticleSystem.DYNAMIC][secondIndex] != true) && 
									!(dynamicEntities[secondIndex].theParent.state == BulletEntity.BULLET_STATE_DEAD && dynamicEntities[secondIndex].theParent.type == Constants.GAME_ENTITY_BULLET) && 
									(dynamicEntities[secondIndex].theParent.state != GameEntity.GAME_ENTITY_STATE_BE_KILLED) &&
									(dynamicEntities[secondIndex].theParent.state != GameEntity.GAME_ENTITY_STATE_IGNORE) ) { 
									
									var compareEntity:Entity = dynamicEntities[secondIndex];
									compareEntity.centre = compareEntity.position.add(compareEntity.centreOffset);
			
									// calculate vector between centre points
									var delta:Vector3 = compareEntity.centre.subtract(currentEntity.centre);
									var restLength:Number = dynamicBoundingBalls[firstIndex] + dynamicBoundingBalls[secondIndex];
									var directDistance:Number = Math.sqrt( delta.x*delta.x + delta.y*delta.y);
									
									if (directDistance < restLength) { // ball collision
										// now test for collisions using type specific methods.
										
										if (currentEntity.type == Entity.TYPE_BOX && compareEntity.type == Entity.TYPE_BOX) {
											/*
											 *	The signs below can be thought of as being suitable for the first element.
											 *	The first element has adds the resulting change vector wheras the second element subtracts the change.
											 *	If delta.? is +ve then the second Entity is below / to the right of the first.
											 *
											 *	Note that the signs refer to the axes, not direction.
											 *	So signY refers to the x direction
											 */ 
											var signY:Number = ( delta.x >= 0 )?-1:1;
											var signX:Number = ( delta.y >= 0 )?-1:1;
														
											var penetrationAxis:Number = 0;
											
											/* 	Because we are dealing with boxes here, we can assume they are 
											 *	already aligned on axes, so we just check lengths against rest length.
											 *  With true seperating axis checks, we would have to project each face onto the collision axes
											 */
											var restLengthX = (EntityBox(currentEntity).width + EntityBox(compareEntity).width )/ 2;								
											var restLengthY = (EntityBox(currentEntity).height + EntityBox(compareEntity).height)/2;
											
											/*
											 *	The penetration in an axis is the rest distance -us the actual distance in that axis
											 *	This is another place where we deal with axes not directions so it looks inverted.
											 *	penetrationX refers to the x axis and thus, the y direction.
											 *	penetrationY refers to the the x direction.
											 *	
											 *	If the penetration value will be lower as the Entities converge, 0 if they touch
											 *	and -ve if they are colliding.
											 */
											var penetrationX:Number = ( restLengthY - Math.abs(delta.y));
											var penetrationY:Number = ( restLengthX - Math.abs(delta.x));
										
											/*
											 *	When doing the circle collision test above, we were able to use restLength because axes don't matter
											 *	with circles.
											 *	With other shapes, there may be a differing rest length in axes.
											 */
											var deltaLength:Number = Math.round(Math.sqrt(delta.dotProduct(delta)) * 1000) / 1000; // the 1000s are to allow for some precision but prevent infiniwobble
											if (deltaLength == 0) { // touching - causes infinity error - TODO this isn't a suitable fix though.
												deltaLength = restLength;
											}
											var diff:Number = (deltaLength - restLength) / deltaLength;
											/*
											 *	As with seperated axis testing, as soon as we find one axis in which they don't penetrate, we can safely
											 *	assume that the objects are not colliding.
											 *	
											 *	TODO
											 *	We can re-order these (ie, put Y first) if we expect there to be less objects coliding in one axis
											 *	than the other.
											 */
											if (penetrationX > 0) { // Entities penetrate each other in the x axis (y direction)
												if (penetrationY > 0) { // Entities also penetrate in y axis (x direction) so there is a collision
													currentEntity.isColiding = true;
													
													// move the objects in the smaller of the penetration axes (because it is more likely to be the direction of movement)
													penetrationAxis = ( penetrationX < penetrationY )?ParticleSystem.AXIS_X:ParticleSystem.AXIS_Y;
													var change:Vector3;
													if (penetrationAxis == ParticleSystem.AXIS_Y) {
														change = new Vector3(signY * penetrationY, 0, 0);
													} else {
														change = new Vector3(0, signX * penetrationX, 0);
													}
													// each object is moved half of the distance to seperate them.
													currentEntity.position = currentEntity.position.add(change.multiply(0.5));
													compareEntity.position = compareEntity.position.subtract(change.multiply(0.5));
												
													var params : Array = new Array();
													params.push(compareEntity.theParent);
													params.push(change.multiply(.5));
													
													// create a logic-level event to respond to the collision
													// becuase physics system loops n times, only want to do this once
													if (i == 0) {
														var smallerIndex : Number = (firstIndex < secondIndex)?firstIndex:secondIndex;
														var largerIndex : Number = (firstIndex > secondIndex)?firstIndex:secondIndex;
								
														hasCollided[smallerIndex][largerIndex] = true;
														//trace("create collision event between: " + smallerIndex +" and " + largerIndex );
														parent.entityEvents.push(new Event(Event.COLLIDE, currentEntity.theParent, params));
														if ( currentEntity.theParent.type != Constants.GAME_ENTITY_BULLET ) {
															params = new Array();
															params.push(currentEntity.theParent);
															params.push(change.multiply(-.5));
															parent.entityEvents.push(new Event(Event.COLLIDE, compareEntity.theParent, params));
														}
													}
												}
											}
											
										} // endif box vs box	
									}// endif ball style collision
								}// endif indexes for first and second Entity are same
								
							}
							
							
						} // end comparison of current Entity against dynamic Entities
						
						/*
						 *	Having compared the current Entity against dynamic Entities, 
						 *	now compare against static Entities.  
						 *	Static Entities don't move so if there is a collision, only move 
						 *	the dynamic Entity.
						 *	Less comments in this loop (so as to save redundancy if technique changes).
						 *	See dynamic loop (above) if anything doesn't make sense.
						 */
						
						 // first, create a collection of nearby static entities.
						var myRow : Number = Math.floor(currentEntity.position.y / 50);
						var myCol : Number = Math.floor(currentEntity.position.x / 50);
						// Changed -1 to -4 below to counter static entities with > 2 size - ie yogurt carton etc
						var minRow = myRow -4;
						var maxRow = myRow + Math.ceil(currentEntity.height / 50);
						// Changed -1 to -4 below to counter static entities with > 2 size - ie yogurt carton etc
						var minCol = myCol -4;
						var maxCol = myCol + Math.ceil(currentEntity.width / 50);
						// trace ("for current entity, based at " + myCol +"," + myRow + " we check from " + minCol +"," + minRow + " to " + maxCol +"," + maxRow);
						var testEntities : Array = new Array();
						
						for (; minRow <= maxRow; minRow ++ ) {
							//trace ("test row: " + minRow);
							for (var tempCol = minCol; tempCol <= maxCol ; tempCol ++) {
							//	trace ("test: " + minRow + "," + tempCol);
							//	trace(levelTileArray[minRow][tempCol]);
								if (!isNaN(levelTileArray[minRow][tempCol])) {
									testEntities.push( staticEntities[levelTileArray[minRow][tempCol]] );
								}
							}
						}
					//	trace(" there are " + testEntities.length + " tiles near this entity");
						 
						for (var secondIndex = 0; secondIndex < testEntities.length; secondIndex++) {
							var compareEntity:Entity = testEntities[secondIndex];
							
							if (!compareEntity.physicsExcempt  && ( excemptionMatrix[firstIndex][ParticleSystem.STATIC][secondIndex] != true ) ) {
								compareEntity.centre = compareEntity.position.add(compareEntity.centreOffset);
								var delta:Vector3 = compareEntity.centre.subtract(currentEntity.centre);
								var restLength:Number = dynamicBoundingBalls[firstIndex] + staticBoundingBalls[secondIndex];
								var directDistance:Number = Math.sqrt( delta.x*delta.x + delta.y*delta.y);
								if (directDistance < restLength) { // ball collision
									if (currentEntity.type == Entity.TYPE_BOX && compareEntity.type == Entity.TYPE_BOX) {
										var signY : Number = ( delta.x >= 0 )?-1:1;
										var signX:Number = ( delta.y >= 0 )?-1:1;
										var penetrationAxis:Number = 0;
										var restLengthX : Number = (EntityBox(currentEntity).width + EntityBox(compareEntity).width )/ 2;								
										var restLengthY : Number = (EntityBox(currentEntity).height + EntityBox(compareEntity).height)/2;
										var penetrationX:Number = ( restLengthY - Math.abs(delta.y));
										var penetrationY:Number = ( restLengthX - Math.abs(delta.x));
										if (penetrationX > 0) {
											if (penetrationY > 0) {
												currentEntity.isColiding = true;
												penetrationAxis = ( penetrationX < penetrationY )?ParticleSystem.AXIS_X:ParticleSystem.AXIS_Y;
												var change:Vector3;
												if (penetrationAxis == ParticleSystem.AXIS_Y) {
													change = new Vector3(signY * penetrationY, 0, 0);
												} else {
													change = new Vector3(0, signX * penetrationX, 0);
												}
												
												// only move dynamic object
												currentEntity.position = currentEntity.position.add(change);
												currentEntity.centre = currentEntity.position.add(currentEntity.centreOffset);
											}
										}
									} // end box vs box							
								} // endif collision
							} // end exclude physicsExcempt statics						
						} // endfor compare vs static items
					} // end check for physics excemption
					
				} // end if test for firstIndex pointing to a null particle.
				
			}// endfor on current dyn object
			
			// satisfy 'stick in a box' constraints
			for (var j:Number = 0; j < stickConstraints.length; j++) {
				var restLength:Number = stickConstraints[j][STICK_RESTLENGTH];
				var firstEntity:Entity = dynamicEntities[ stickConstraints[j][STICK_FIRST ]];
				var secondEntity:Entity = dynamicEntities[ stickConstraints[j][STICK_SECOND ]];
				
				var delta:Vector3 = secondEntity.position.subtract(firstEntity.position);
				// we can remove the sqrt requirement to optimise (see http://www.gotoandplay.it/_articles/2005/08/advCharPhysics.php )
				var deltaLength:Number = Math.round(Math.sqrt(delta.dotProduct(delta)) * 1000) / 1000; // the 1000s are to allow for some precision (3 dec pl) but prevent infiniwobble
				if (deltaLength == 0) { 
					// touching - causes infinity error - not a good solution either, but better than unsolvable math.
					deltaLength = restLength;
				}
				var diff:Number = (deltaLength - restLength) / deltaLength;
				firstEntity.position = firstEntity.position.add(delta.multiply(0.5).multiply(diff));
				secondEntity.position = secondEntity.position.subtract(delta.multiply(0.5).multiply(diff));
			}
			
			/*
			 * 	Finally satisfy world boundary constraints.
			 *	Because this is the last constraint to be satisfied, the particles will never leave the world.
			 */
			for (var j:Number = 0; j < dynamicEntities.length; j++) {
				if ( dynamicEntities[j] != null ) {
					var currentEntity:Entity = dynamicEntities[j];
					if ( !currentEntity.physicsExcempt ) {
						/*
						 *	Update each component of the position vector indepentantly to keep the Entity in bounds.
						 */
						 currentEntity.position = vMin(vMax(currentEntity.position, worldMin), worldMax.subtract(currentEntity.bottomRightOffset));
					}
				}
			}
		}
	}
	
	/**
	 *	Performs a component wise min function and returns the result.
	 */
	function vMin(firstVector:Vector3, secondVector:Vector3):Vector3 {
		var min:Vector3 = new Vector3();
		min.x = (firstVector.x < secondVector.x)?firstVector.x:secondVector.x;
		min.y = (firstVector.y < secondVector.y)?firstVector.y:secondVector.y;
		min.z = (firstVector.z < secondVector.z)?firstVector.z:secondVector.z;		
		return min;
	}
	
	
	/**
	 *	Performs a component wise max function and returns the result.
	 */
	function vMax(firstVector:Vector3, secondVector:Vector3):Vector3 {
		var max:Vector3 = new Vector3();
		max.x = (firstVector.x > secondVector.x)?firstVector.x:secondVector.x;
		max.y = (firstVector.y > secondVector.y)?firstVector.y:secondVector.y;
		max.z = (firstVector.z > secondVector.z)?firstVector.z:secondVector.z;		
		return max;
	}
	
	public function removeEntity(isDynamic : Boolean, index : Number) : Boolean {
		if (isDynamic) {
			var startSize = dynamicEntities.length;

			delete(dynamicEntities[index]);
			delete(dynamicBoundingBalls[index]);
			dynamicEntities[index] = null;
			dynamicBoundingBalls[index] = null;
			/*dynamicEntities.splice(index, 1);
			dynamicBoundingBalls.splice(index, 1);
			for ( var i : Number = index; i < dynamicEntities.length; i ++ ) {
				var entity : Entity = Entity(dynamicEntities[i]);
				entity.theParent.particleArrayId --;
			}
			*/
			
		} else {
			var startSize = staticEntities.length;

			delete(staticEntities[index]);
			delete(staticBoundingBalls[index]);
			staticEntities[index] = null;
			staticBoundingBalls[index] = null;
			/*
			staticEntities.splice(index, 1);
			staticBoundingBalls.splice(index, 1);
			
			for ( var i : Number = index; i < staticEntities.length; i ++ ) {
				var entity : Entity = Entity(staticEntities[i]);
				entity.theParent.particleArrayId --;
			}
			
			if ( staticEntities.length == ( startSize -1)) {
				return true;	
			} else {
				return false;	
			}*/
		}
		return true;
	}

}