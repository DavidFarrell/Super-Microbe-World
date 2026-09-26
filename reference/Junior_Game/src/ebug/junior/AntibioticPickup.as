import ebug.Entity;
import ebug.junior.PlatformGame;
import ebug.Constants;
import ebug.junior.*;
import ebug.ParticleSystem;

/**
 * @author sbbc231
 * 
 * The antibiotic pickup entity is static.  This means that it is considered a background tile by the particle engine and as such, doesn't generate events.
 * However, the pickup is also a gameEntity - and this means that it is in the entities array inside PlatformGame.
 * Each entity in this array is given a slice of thinking time per update and in the pickup's case, it performs a hitTest against
 * the player movie to see if the two have collided. 
 * If a collision has taken place, appropriate events are generated.
 */
class ebug.junior.AntibioticPickup extends GameEntity {
 	public function AntibioticPickup(inGame : PlatformGame, inParticle:Entity, inClip:MovieClip) {
		super(inGame, inParticle, inClip);
		counterCeiling = 1;
		thinkTime = 0;
		particle.theParent = this;
		particle.physicsExcempt = true;
		particle.isDynamic = false;
		state = GameEntity.GAME_ENTITY_STATE_IDLE;
	}

	public function advance() : Array {
		var events : Array = new Array();
		switch (state) {
			case GAME_ENTITY_STATE_IDLE : 
				if ( clip.hitTest(theGame.entities[PlatformGame.PLAYER_INDEX].clip) ) {
					var params : Array = new Array();
					params.push(theGame.entities[PlatformGame.PLAYER_INDEX]);
					events.push(new Event (Event.COLLIDE, this, params));
				}
				break;
			case GameEntity.GAME_ENTITY_STATE_DEFAULT :
				;
				break
		}	
		return events;
	}
	
	public function act(e : Event) : Array {
		var events : Array = new Array();;
		
		switch (e.type) {
			case Event.COLLIDE:
				if (state != GameEntity.GAME_ENTITY_STATE_DEFAULT){
					if ( e.params[0].type == Constants.GAME_ENTITY_PLAYER) {
						if ( (PlayerEntity(e.params[0])).has_antibiotic == false ) {
							events.push(new Event(Event.REMOVE, this, null));
							events.push(new Event(Event.PICKUP_ANTIBIOTIC, this, null));
							remove();
						} 
					}
				}
				break;
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
}
//eof