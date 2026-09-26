import ebug.Entity;
import ebug.Constants;
import ebug.Vector3;
import ebug.junior.*;



/**
 * @author sbbc231
 */
class ebug.junior.GameEntity {
	public var state : Number;
	
	public var type : Number;

	public var weight : Number ;
	public var speed:Number; 
	
	public var theGame : PlatformGame;
	public var particle : Entity;
	public var particleArrayId : Number;
	public var particleIsDynamic : Boolean;
	public var clip : MovieClip;


	public var indexId : Number;

	// sometimes, an entity may queue a state
	public var nextState : Number;
	public var nextAnimation : String;
	
	public var counter : Number;
	public var counterCeiling : Number;
	public var direction : Number;
	
	public var naturalXScale : Number; 
	public var naturalYScale : Number; 
	
	// if an entity is off-screen, it is not updated
	public var isOnScreen : Boolean;
	
	/*
	 * if the entity 'thinks' that it won't have to make a decision
	 * for a while, set this > 0.  Each cycle, this will be decremented
	 * when == 0, Act is called. 
	 */
	public var thinkTime : Number;
	public var defaultThinkTime : Number = 5;
	
	// track which grid points we are in.
	// this is used for non-physics collision detection
	public var col : Number;
	public var row : Number;
	public var colWidth : Number;
	public var rowHeight : Number;

	public static var LEFT : Number = -1;
	public static var RIGHT : Number = 1;

	// used to detect when a game entity is 'on the ground'
	public static var SAFE_TRAVEL_DISTANCE : Number = 1.5;

	/*
	 * Game Entity states go here.
	 * Non-obvious ones should be commented!
	 */
	public static var GAME_ENTITY_STATE_DEFAULT : Number = 0;
	public static var GAME_ENTITY_STATE_TURN : Number = 1;
	// if a game entity is 'dynamic', it is being controlled by the particle system
	public static var GAME_ENTITY_STATE_DYNAMIC : Number = 4;
	
	public static var GAME_ENTITY_STATE_IDLE : Number = 5;
	public static var GAME_ENTITY_STATE_BE_LIFTED : Number = 6;
	public static var GAME_ENTITY_STATE_SLIDE : Number = 7;
	public static var GAME_ENTITY_STATE_FALL : Number = 8;
	public static var GAME_ENTITY_STATE_BE_PHOTOGRAPHED : Number = 9;
	public static var GAME_ENTITY_STATE_BE_KILLED : Number = 10;
	public static var GAME_ENTITY_STATE_WALK : Number = 11;
	public static var GAME_ENTITY_STATE_JUMP_START : Number = 12;
	public static var GAME_ENTITY_STATE_JUMP_MID : Number = 13;
	public static var GAME_ENTITY_STATE_JUMP_END : Number = 14;
	public static var GAME_ENTITY_STATE_BE_FROZEN : Number = 15;
	public static var GAME_ENTITY_STATE_BE_WASHED_AWAY : Number = 16;
	public static var GAME_ENTITY_STATE_MUNCH : Number = 17;
	public static var GAME_ENTITY_STATE_RUN : Number = 18;
	public static var GAME_ENTITY_STATE_DIVE : Number = 19;
	public static var GAME_ENTITY_STATE_STARE : Number = 20;
	public static var GAME_ENTITY_STATE_FLICK_HEAD : Number = 21;
	public static var GAME_ENTITY_STATE_BE_HIT : Number = 22;
	public static var GAME_ENTITY_STATE_IGNORE : Number = 23;
	
	/* 
	 * Bespoke Entity States are reserved from items 100 -> 200 
	 */
	//public static var BESPOKE_ENTITY_STATE_X : Number = 100; 
	
	public function GameEntity(inGame : PlatformGame, inParticle:Entity, inClip:MovieClip) {
		counter = 0;
		counterCeiling = 3;
		direction = RIGHT;
		rowHeight = 0;
		colWidth = 0;
		isOnScreen = false;
		weight = 10;
		thinkTime = 0;
		naturalXScale = 100;
		naturalYScale = 100;
		
		theGame = inGame;
		row = 0;
		col = 0;
		particle = inParticle;
		clip = inClip;
		state = GAME_ENTITY_STATE_FALL;		
	}

	public function advance() : Array {
		if (this.col < 5) { 
			trace("ADVANCE state: " + state);
		} 
		var debugText = "";;
		
		var events : Array = null;	
		thinkTime --;
		
		var think : Boolean = false;
		if ( thinkTime >= 0 ) {
			debugText += " -> advancing to move";
			think = false;
		} else {
			debugText += " -> advancing to think";
			think = true;	
		}
		
		switch ( state ) {
			case GameEntity.GAME_ENTITY_STATE_WALK :
				if (think) {
					events = walkThink();
				} else {
					events = walk();
				}
				break;
			case GameEntity.GAME_ENTITY_STATE_IDLE : 
				if (think) {
					events = idleThink();
				} else {
					events = idle();
				}
				break;
			case GameEntity.GAME_ENTITY_STATE_FALL : 
				if (think) {
					events = fallThink();
				} else {
					events = fall();
				}
				break;
			
			
		}
		return events;
	}
	
	public function act(e : Event) : Array {
		var events : Array = null;	
		thinkTime --;
		
		var debugText = "";;
		/*
		 * most of the time, the event is just THINK
		 * if it is something else, it means we have just started this event
		 */
		switch ( e.type ) {
			case Event.THINK :
					trace ("thinking?");
					thinkTime++;
					events = advance();
				break;

			case Event.WALK :
				state = GameEntity.GAME_ENTITY_STATE_WALK;
				direction = e.params[0];
				clip.gotoAndPlay("walk");
				
				thinkTime = 0;
				events = advance();
				break;
				
			case Event.IDLE :
				state = GameEntity.GAME_ENTITY_STATE_IDLE;
				clip.gotoAndPlay("idle");
				thinkTime = e.params[0];
				
				events = advance();
				break;
				
			case Event.FALL :
				state = GameEntity.GAME_ENTITY_STATE_FALL;
				counterCeiling = 3;
				counter = counterCeiling;
				clip.gotoAndPlay("fall");
				
				events = advance();				
				break;
				
			case Event.COLLIDE :
				state = GameEntity.GAME_ENTITY_STATE_FALL;
				clip.gotoAndPlay("be_hit");
				
				particle.physicsExcempt = false;
				counterCeiling = 10;
				counter = counterCeiling;
				
				events = advance();
		}
		if (this.col < 5) { 
			trace("ACT state: " + state);
		} 
		theGame.debugTopRightText.htmlText = debugText;
		return events;
	}
	
	private function walk() : Array {
		var events : Array = null;
		var nextCol : Number = (direction == RIGHT)?col + 1: col - 1;
		var colX : Number = col * Constants.TILE_WIDTH;

		particle.teleport( new Vector3( particle.position.x + (speed * direction) , particle.position.y, particle.position.z));
		trace("\nI am " + clip._name);
		trace("Walking: Nextcol is " + nextCol);
		trace("Position X is: " + particle.position.x);
		trace ("speed is: " + speed);
		trace ("effective speed is: " + (speed * direction));
		
		// has the entity left the column?
		var distanceFromColX : Number = particle.position.x - colX;
		if ( (direction == RIGHT && distanceFromColX >= Constants.TILE_WIDTH) || ( direction == LEFT && distanceFromColX < 0 ) ) {
			col = nextCol;
			clip.debugText.htmlText = col + ", " + row;
		} 
		
		return events;
	}
	
	private function walkThink() : Array {
		trace ("walkthink " + clip._name);
		var events : Array = null;
		var colX : Number = col * Constants.TILE_WIDTH;
		var nextCol : Number = (direction == RIGHT)?col + 1: col - 1;
		var nextColX : Number = nextCol * Constants.TILE_WIDTH;

		if ( safeToMove(colX, nextCol) ) {
			if ( direction == RIGHT ) {
				thinkTime = Math.floor( (nextColX - (particle.position.x + particle.width)) / speed);
				
				// if this move will put over next cell threshold, see if can keep walking.
				if (particle.position.x + speed + particle.width > colX + Constants.TILE_WIDTH) {
					var dangerousToSleep : Boolean = false;
					for ( var i : Number = 0;i < rowHeight; i++ ) {
						if ( !isNaN(theGame.level.levelDataGeometry[row+i][(nextCol+1)]) ) {
							// there must be a tile next to this entity - cannot sleep
							dangerousToSleep = true;
						} 
					}
					if (!dangerousToSleep) {
						thinkTime += Math.floor(Constants.TILE_WIDTH / speed) - 1;
					}
					thinkTime += Math.floor(Constants.TILE_WIDTH / speed) - 1;	
				}
				if (thinkTime <=0) {
					thinkTime = 1;
				}
			} else {
				thinkTime = Math.floor((particle.position.x - colX) / speed);
				// predict if safe to assume whole next tile is OK
				if (particle.position.x + speed + particle.width > colX + Constants.TILE_WIDTH) {
					thinkTime += Math.floor(Constants.TILE_WIDTH / speed) - 1;					
				}
				
				if (thinkTime <=0) {
					thinkTime = 1;
				}
			}
		} else { 
			// not safe to move, so fall back to default idle state.
			var params : Array = new Array();
			params.push(defaultThinkTime);
			events = new Array();
			events.push(new Event(Event.IDLE, this, params));
		}
		return events;	
	}
	
	private function fall() : Array {
		var events : Array = null;
		var distanceTravelled : Number = particle.position.y - particle.previousPosition.y;
		if ( distanceTravelled < GameEntity.SAFE_TRAVEL_DISTANCE ) {
				counter--;	
			} else {
				counter = counterCeiling;
		}
		
		return events;	
	}
	
	private function fallThink() : Array {
		var events : Array = null;
		
		if (!onSolidGround()) {
			particle.physicsExcempt = false;
			thinkTime = defaultThinkTime*2;
		} else {
			if ( particle.position.x > particle.previousPosition.x ) {
				direction = RIGHT;
			} else {
				direction = LEFT;	
			}
			
			col = Math.floor( ( (particle.position.x ) / Constants.TILE_WIDTH));
			row = Math.floor( particle.position.y / Constants.TILE_WIDTH);
			particle.physicsExcempt = true;
			particle.previousPosition = particle.position.clone();
			counterCeiling = 3;
			
			var params : Array = new Array();
			params.push(defaultThinkTime);
			events = new Array();
			events.push(new Event(Event.IDLE, this, params));
			
		}
		return events;	
	}
	
	public function getPhotographed() : Void {
		
	}
	
	private function idle() : Array  {
//		trace("idle");
		var events : Array = null;		
		return events;	
	}
	
	private function idleThink() : Array {
//		trace("idleThink ("+col+","+row+")" + particle.position + " vs + " + particle.previousPosition);
		var events : Array = null;
		var nextCol : Number = (direction == RIGHT)?col + 1: col - 1;
		var colX : Number = col * Constants.TILE_WIDTH;		
		if (direction == LEFT) {
			if (safeToMove(colX, nextCol)) {
				events = new Array();
				var params : Array = new Array();
				params.push(LEFT);
				events.push(new Event(Event.WALK, this, params ));
			} else {
				direction = RIGHT;
				nextCol = (direction == RIGHT)?col + 1: col - 1;
				if (safeToMove(colX, nextCol)) {
					events = new Array();
					var params : Array = new Array();
					params.push(RIGHT);
					events.push(new Event(Event.WALK, this, params));
				} else {
					if (!onSolidGround()) {
						events = new Array();
						var params : Array = new Array();
						events.push(new Event(Event.FALL, this, params));	
					} else {
						// not safe to move in either direction.
						thinkTime = defaultThinkTime;
//						trace (this + " sez \"I'm stuck < \"");
						direction = LEFT;
					}	
				}
			}
		} else { 
			if (safeToMove(colX, nextCol)) {
				events = new Array();
				var params : Array = new Array();
				params.push(RIGHT);
				events.push(new Event(Event.WALK, this, params));
			} else {
				direction = LEFT;
				nextCol = (direction == RIGHT)?col + 1: col - 1;
				if (safeToMove(colX, nextCol)) {
					events = new Array();
					var params : Array = new Array();
					params.push(LEFT);
					events.push(new Event(Event.WALK, this, params));
				} else {
					if (!onSolidGround()) {
						events = new Array();
						var params : Array = new Array();
						events.push(new Event(Event.FALL, this, params));	
					} else {
						// not safe to move in either direction.
						thinkTime = defaultThinkTime;
//						trace (this + " sez \"I'm stuck >\"");
						direction = RIGHT;
					}
				}
			}
		}
		return events;
	}
	
		
	/*
	 * Returns whether there is room for movement after one unit of speed
	 */
	private function safeToMove(colX : Number, nextCol : Number) : Boolean {
		var distanceFromColX : Number = particle.position.x - colX;
		var roomToMove : Boolean = false;
		
		if ( direction == RIGHT) {
			roomToMove = ( distanceFromColX + clip._width + speed > Constants.TILE_WIDTH)?false:true;
			if (roomToMove) {
				roomToMove = onSolidGround();	
			}
		} else {
			roomToMove = ( distanceFromColX > speed )?true:false;
			if (roomToMove) {
				roomToMove = onSolidGround();	
			}
		}
		
		if ( roomToMove ) {
			return true;	
		} else {
			// check for walls and floors in the next column.
			if ( direction == RIGHT && !roomToMove ) {
				for ( var i : Number = 0;i < rowHeight; i++ ) {
					//trace ("In ["+col + ","+row+"] ping " + nextCol + ", " + (row+i) + " == " + !isNaN(theGame.level.levelDataGeometry[row+i][nextCol]));
					if ( !isNaN(theGame.level.levelDataGeometry[row+i][nextCol]) ) {
						// there is a wall in the next cell - so the microbe cannot move there.
//						trace("canny move right - wall");
						return false;
					} 
				}
				// if there are no wall tiles, check for a floor tile in the next column
				if ( isNaN( theGame.level.levelDataGeometry[row + rowHeight][nextCol] ) ) {
					// there is no floor tile in the next column
						//trace("canny move right - no floor");
					return false;
				} else {
					// there are no wall tiles but there is a floor tile, so safe to walk
					return true;
				} 
			} else if ( direction == LEFT && !roomToMove ) {	
				// check for walls in next tile		
				for ( var i : Number = 0;i < rowHeight; i++ ) {
					if ( !isNaN(theGame.level.levelDataGeometry[row+i][nextCol]) ) {
						// there is a wall
//						trace("canny move left - wall");
						return false;					
					} 
				}
				// if there are no wall tiles, check for a floor tile in the next column
				if ( isNaN( theGame.level.levelDataGeometry[row + rowHeight][nextCol] ) ) {
					// there is no floor in next column
//						trace("canny move left - floor");
					return false;
				} else {
					// there is a floor tile in the next column, so safe to move there
					return true;
				}
			}	
		}
	}

	

	public function onSolidGround() : Boolean {
		if ( !particle.physicsExcempt ) {
			var distanceTravelled : Number = Math.abs(particle.position.y - particle.previousPosition.y) ;
			if ( distanceTravelled < GameEntity.SAFE_TRAVEL_DISTANCE ) {
				if (counter <= 0) {
					return true;
				} else {
					counter--;	
				}
			} else {
				counter = counterCeiling;
			}
			return false;
		} else {
			var checkCol : Number;
			var checkRow : Number;
			checkCol = Math.floor( (particle.position.x ) / Constants.TILE_WIDTH);
			checkRow = Math.floor( (particle.position.y + clip._height)  / Constants.TILE_WIDTH) ;
			if ( isNaN(theGame.level.levelDataGeometry[checkRow][checkCol]) ) { 
				return false;
			} else {
				// check to see if game entity has been pushed into a tile
				var penetration : Number = clip._y + clip._height - ( (row + rowHeight) * Constants.TILE_WIDTH);
				if ( penetration > 0 ) {
					particle.position.y -= penetration;	
				}
				return true;
			}
		}
	}
	
		
	public function kill() : Array {
		var events : Array = new Array();
		trace ("kill entity");
		clip.gotoAndPlay("be_killed");
		state = GameEntity.GAME_ENTITY_STATE_BE_KILLED;
		
		return events;	
	}
	
	private function beKilledThink() : Array {
		var events : Array = new Array();
		if ( clip.midAnimation == false ) {
			events.push(new Event(Event.REMOVE, this, null));
			remove();
		}
		return events;	
	}
	
	
	public function remove() : Void {
		particle.gravityExcempt = true;
		this.isOnScreen = false;
		this.defaultThinkTime = 9999999;
		this.thinkTime = defaultThinkTime;
		state = GameEntity.GAME_ENTITY_STATE_DEFAULT;
		
		//delete(particle);
		clip.removeMovieClip();
	}
	
	public function showPosition() : String {
		return "[("+particle.position.x+","+particle.position.y+")->("+particle.previousPosition.x+","+particle.previousPosition.y+")]";
	}
}
