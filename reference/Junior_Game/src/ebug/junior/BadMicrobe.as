import ebug.Constants;
import ebug.Entity;
import ebug.Vector3;
import ebug.junior.PlatformGame;
import ebug.Level;
import ebug.junior.*;
import ebug.Tile;

/**
 * @author sbbc231
 */
class ebug.junior.BadMicrobe extends Microbe {
 
	private var slideTimer : Number;
	private var slideTimerDefault : Number;
	
	private var washAway : Boolean;
	
	public static var EVENT_BAD_MICROBE_WASH_AWAY			: Number = 51;
	
	// TODO reconsider this constructor with the entities array in PlatformGame
	public function BadMicrobe(inGame : PlatformGame, inRow:Number, inCol:Number, inParticle:Entity, inClip:MovieClip) {
		theGame = inGame;
		particle = inParticle;
		clip = inClip;
		row = inRow;
		col = inCol;
		speed = 10;
		hasBeenPhotographed = false;
		direction = RIGHT;
		particle.physicsExcempt = true;
		particle.isDynamic = true;
		washAway = false;
		slideTimer = slideTimerDefault = 10;
		
		clip.gotoAndPlay("idle");
		state = GameEntity.GAME_ENTITY_STATE_FALL;
		thinkTime = 0;
		lives = 1;
		
		colWidth = Math.ceil(clip._width / Constants.TILE_WIDTH); 
		rowHeight = Math.ceil(clip._height / Constants.TILE_WIDTH);
	}
	
	public function advance() : Array {
/*		if (this.col <= 4) { 
			trace("("+col+","+row+") ADVANCE state: " + state);
		} 
*/		var debugText = "";;
		
		var events : Array = new Array();	
		thinkTime --;
		
		var think : Boolean = false;
		if ( thinkTime >= 0 ) {
			debugText += " -> advancing to move";
			think = false;
		} else {
			debugText += " -> advancing to think";
			think = true;	
		}
		if (isOnScreen) {
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
				case GameEntity.GAME_ENTITY_STATE_SLIDE : 
					slideTimer --;
					if (think) {
						events = slideThink();
					} else {
						events = slide();
					}
					break;
				case GameEntity.GAME_ENTITY_STATE_BE_PHOTOGRAPHED : 
					if (think) {
						events = bePhotographedThink();
					} else {
						events = bePhotographed();
					}
					break;
				case GameEntity.GAME_ENTITY_STATE_BE_HIT : 
					if (think) {
						events = beHitThink();
					} else {
						events = beHit();
					}
					break;
				case GameEntity.GAME_ENTITY_STATE_BE_KILLED : 
					if (think) {
						events = beKilledThink();
					} else {
						events = beKilled();
					}
					break;
				case GameEntity.GAME_ENTITY_STATE_BE_WASHED_AWAY : 
					if (think) {
						events = beWashedThink();
					} else {
						events = beWashed();
					}
					break;
			}
		}
		return events;
	}
	
	public function act(e : Event) : Array {
//		
		var events : Array = new Array();	
		if (isOnScreen) {
			thinkTime --;
		
			var debugText = "";;
			/*
			 * most of the time, the event is just THINK
			 * if it is something else, it means we have just started this event
			 */
			switch ( e.type ) {
				case Event.THINK :
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
					if (state != GameEntity.GAME_ENTITY_STATE_FALL && state != GameEntity.GAME_ENTITY_STATE_SLIDE 
					 && state != GameEntity.GAME_ENTITY_STATE_BE_PHOTOGRAPHED && state != GameEntity.GAME_ENTITY_STATE_BE_HIT 
					 && state != GameEntity.GAME_ENTITY_STATE_BE_KILLED && state != GameEntity.GAME_ENTITY_STATE_BE_WASHED_AWAY) {
						 trace ("I am being collided with and my state is: " + state);
						if (e.params[0] instanceof GoodMicrobe || e.params[0] instanceof PlayerEntity || e.params[0] instanceof BulletEntity ) {
							if ( e.params[0] instanceof BulletEntity ) {
								washAway = true;
							} else washAway = false;
							
							var params : Array = new Array();
							params.push (1);
							events.push( new Event(Event.BE_HURT, this, params)); 
						
							state = GameEntity.GAME_ENTITY_STATE_SLIDE;
							slideTimer = slideTimerDefault;
							particle.physicsExcempt = false;
							counterCeiling = 10;
							counter = counterCeiling;
						} else {
							state = GameEntity.GAME_ENTITY_STATE_SLIDE;
							clip.gotoAndPlay("slide");
							
							slideTimer = slideTimerDefault;
							particle.physicsExcempt = false;
							counterCeiling = 10;
							counter = counterCeiling;
						}
						
						events = events.concat(advance());
					}
					break;
				case Event.BE_HURT :
					lives -= e.params[0];
					trace("bad microbe be hurt (microbe) " + lives);
					clip.gotoAndPlay("be_hit");
					state = GameEntity.GAME_ENTITY_STATE_BE_HIT;
						
					if ( lives <= 0 && state != GameEntity.GAME_ENTITY_STATE_BE_KILLED) {
						if (!washAway) {
							events.push( new Event(Event.BE_KILLED, this, params));
							clip.gotoAndPlay("be_killed");
						} else  {
							events.push( new Event(EVENT_BAD_MICROBE_WASH_AWAY, this, params));
							clip.gotoAndPlay("be_washed_away");
						}	
						
					}
					break;
				case Event.BE_KILLED :
					state = GameEntity.GAME_ENTITY_STATE_BE_KILLED;
					
					break;	
				case EVENT_BAD_MICROBE_WASH_AWAY :
					particle.physicsExcempt = true;
					particle.gravityExcempt = true;
					
					state = GameEntity.GAME_ENTITY_STATE_BE_WASHED_AWAY;
					
					break;					
				case Event.BE_PHOTOGRAPHED :
					if ( !hasBeenPhotographed ) {
						hasBeenPhotographed = true;
						state = GameEntity.GAME_ENTITY_STATE_BE_PHOTOGRAPHED;
						clip.gotoAndPlay("be_photographed");
						thinkTime = defaultThinkTime;
						particle.physicsExcempt = true;
						events = advance();
					}
				
					
					break;
			}
		}
		return events;
	}
	
	private function slide() : Array {
		var events : Array = new Array();
		var distanceTravelled : Number = particle.position.y - particle.previousPosition.y;
		if ( distanceTravelled < GameEntity.SAFE_TRAVEL_DISTANCE ) {
				counter--;	
			} else {
				counter = counterCeiling;
		}
		
		return events;	
	}
	
	private function slideThink() : Array {
		var events : Array = new Array();
		if (slideTimer > 0 && !onSolidGround()) { 
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
			params.push(1);
			events = new Array();
			events.push(new Event(Event.IDLE, this, params));
		}
		return events;	
	}
	
	private function idle() : Array  {
		var events : Array = new Array();		
		return events;	
	}
	
	private function idleThink() : Array {
//		trace("idleThink ("+col+","+row+")" + particle.position + " vs + " + particle.previousPosition);
		var events : Array = new Array();
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
	
	private function bePhotographed() : Array {
		var events : Array = new Array();		
		
		return events;	
	}
	
	private function bePhotographedThink() : Array {
		var events : Array = new Array();
		if ( clip.midAnimation == false ) {
			if ( particle.position.x > particle.previousPosition.x ) {
				direction = RIGHT;
			} else if ( particle.position.x < particle.previousPosition.x ) {
				direction = LEFT;	
			}
			
			col = Math.floor( ( (particle.position.x ) / Constants.TILE_WIDTH));
			row = Math.floor( particle.position.y / Constants.TILE_WIDTH);
			particle.physicsExcempt = true;
			particle.previousPosition = particle.position.clone();
			
			var params : Array = new Array();
			params.push(3);
			events = new Array();
			events.push(new Event(Event.FALL, this, params));
		}
		return events;	
	}
	
	private function beHit() : Array {
		var events : Array = new Array();		
		
		return events;	
	}
	
	private function beHitThink() : Array {
		var events : Array = new Array();
		if ( clip.midAnimation == false ) {
			if ( particle.position.x > particle.previousPosition.x ) {
				direction = RIGHT;
			} else if ( particle.position.x < particle.previousPosition.x ) {
				direction = LEFT;	
			}
			
			col = Math.floor( ( (particle.position.x ) / Constants.TILE_WIDTH));
			row = Math.floor( particle.position.y / Constants.TILE_WIDTH);
			particle.physicsExcempt = true;
			particle.previousPosition = particle.position.clone();
			
			var params : Array = new Array();
			params.push(3);
			events = new Array();
			events.push(new Event(Event.FALL, this, params));
		}
		return events;	
	}
	
	private function beKilled() : Array {
		var events : Array = new Array();		
		
		return events;	
	}
	
	private function beKilledThink() : Array {
		var events : Array = new Array();
		if ( clip.midAnimation == false ) { 
			trace ("not mid animation, so trigger kill");
			//var killEvent : Event = new Event(Event.BE_KILLED, this, null);
			//theGame.entityEvents.push(killEvent);
			/*for ( var i : Number = 0; i < theGame.goals.length; i++) {
				var goal : Goal = theGame.goals[i];
				goal.updateGoal(killEvent);	
			}*/
			events.push(new Event(Event.REMOVE, this, null));
			remove();
			state = GameEntity.GAME_ENTITY_STATE_DEFAULT;
			thinkTime = 9999999;
		}
		return events;	
	}
	
	private function beWashed() : Array {
		var events : Array = new Array();		
		
		particle.position.y -= 15;
		clip._alpha -=5;
		return events;	
	}
	
	private function beWashedThink() : Array {
		var events : Array = new Array();
		if ( clip._alpha <=0 ) {
			events.push(new Event(Event.REMOVE, this, null));
			remove();
			events.push(new Event(Event.BE_KILLED, this, null));
		}
		thinkTime = defaultThinkTime;
		return events;	
	}
	
	public function remove() : Void {
		particle.physicsExcempt = true;
		isOnScreen = false;
		particle.position.x = -100;
		particle.position.y = -100;
		//	delete(particle);
		//clip.removeMovieClip();
		clip._visible = false;
//		delete(hurtGood);
//		delete(hurtBad);
//		delete(hurtHuman);
//		delete(damage);
//		delete(impactForce);
	}
	
	
	
}
//eof