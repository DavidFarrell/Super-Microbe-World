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
class ebug.junior.SuperBug extends Microbe {
	

	public function SuperBug(inGame : PlatformGame, inRow:Number, inCol:Number, inParticle:Entity, inClip:MovieClip) {
		theGame = inGame;
		particle = inParticle;
		clip = inClip;
		row = inRow;
		col = inCol;
		direction = RIGHT;
		particle.physicsExcempt = true;
		particle.isDynamic = true;
		washAway = false;
		
		clip.gotoAndPlay("idle");
		state = GameEntity.GAME_ENTITY_STATE_IDLE;
		thinkTime = 0;
		lives = 4;
		
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
				case GameEntity.GAME_ENTITY_STATE_IDLE : 
					if (think) {
						events = idleThink();
					} else {
						events = idle();
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
			}
		}
		return events;
	}
	
	
	public function act(e : Event) : Array {
		var events : Array = new Array();	
		var debugText = "";;
		/*
		 * most of the time, the event is just THINK
		 * if it is something else, it means we have just started this event
		 */
		trace ("superinfection acting upon event type " + e.type);
		switch ( e.type ) {
			case Event.BE_HURT :
				lives -= e.params[0];
				var animation : String = "be_hit_" + (5 - lives) ;
				trace ("super animate: " + animation);
				clip.gotoAndPlay(animation);
				state = GameEntity.GAME_ENTITY_STATE_BE_HIT;
					
				if ( lives <= 0 && state != GameEntity.GAME_ENTITY_STATE_BE_KILLED) {
					events.push( new Event(Event.BE_KILLED, this, params));
					clip.gotoAndPlay("be_killed");
				}
				break;
			case Event.BE_KILLED :
				state = GameEntity.GAME_ENTITY_STATE_BE_KILLED;
				
				break;	
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
	
	
	public function remove() : Void {
		particle.physicsExcempt = true;
		isOnScreen = false;
		particle.position.x = -100;
		particle.position.y = -100;
		//	delete(particle);
		//clip.removeMovieClip();
		clip._visible = false;
	}
	
	
	
}
//eof