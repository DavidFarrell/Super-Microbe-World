#pragma strict



public class WalkingMicrobe extends Microbe {
	
	/*Public vars*/
	public var Speed: float = 1;				//the max speed that the microbe will reach
	public var facingRight: boolean = true;		//if the bug will face (and walk) right at first. Note that in the preview it will always face right independently of this value.
	public var moveDistance: int = 50;			//Maximum amount of movement that the bug will perform right and left. If there is not more ground or there is a wall it will turn itself (Without reaching this distance)
	public var timeWaiting: float = 3;			//Time in seconds that the bug will be waiting once stopped before turning around
	public var platformCheck: GameObject;		//An empty GameObject placed in front (on the right) of the microbe under the ground. It will be used to see if there is more platform in front of it to continue walking. When there is not platform in this point, the microbe will turn.
	public var turningOffset: float = 0.5;		//The sprites of some Microbes are not centered, so when turning, the movement doesn't look natural. It may be neccesary to move a little the sprite when turning to solve this priblem. That's what this variable is for. (Look the Flip() method to see how it's used)
	public var DestroysOnEnemyContact: boolean = true;	//The microbe with this boolean set to true will be killed in contact with an enemy. Eg if this bug has the "enemy" tag, and bumps with a microbe with the "nonEnemy" tag, both will die. The opposite also happens.
	public var MustJumpOnLedge: boolean = false;		//If true, when the microbe is displayed on the screen and reachs a ledge it will jump. BE CAREFUL! only jumper microbes can jump (slurm, super_slurm, colin, super colin, steve and iggy). The rest of them does't have the jump animation
	public var jumpOnLedgeForce: Vector2 = Vector2(3600, 25000);	//Force to be applied on the jump.
	private var hasJumped: boolean = false;		//Will be true when the microbe has jumped an is on the air (false when landed)
	public var SecondsBeforeJumping: float = 1;	//Time that the microbe will wait before jumping.
	
	protected var isWalking: boolean = false;
	protected var isWaiting: boolean = false;
	protected var direction: Vector2 = facingRight ? Vector2.right : Vector2.right * (-1);
	
	private var groundPoint: Vector2;			//will contain a point which is placed just in front of lucy under the ground to check if It will be possible to continue walking in this platform
	private var groundHits: Collider2D[];
	private var groundHitsNumber: int;
	private var platformTransform: Transform;
	
	 
	
	function Awake () {
	
		super.Awake();								//To execute the Awake() function of the Microbe class
		
		if (moveDistance < 0) moveDistance *= -1;	//To assure that moveDistance is always positive when beginning this script
		if (!facingRight){
			facingRight = true;						//Flip() will change the value of facingRight to false and the sign of moveDistance to negative. That's why this is done.
			direction = facingRight ? Vector2.right : Vector2.right * (-1);
			Flip();
		}
		
		//iTween.Init(gameObject);					//Initializing iTween in order to avoid hiccups when first playing the movements	//It's already done in the Microbe's class
		
		groundHits = new Collider2D[3];
		
		platformTransform = platformCheck.transform;
	
	}
	
	function Start () {

	}

	function Update () {
	
	}
	
	function FixedUpdate(){
	
		if(!isWaiting && !killedAlready){
			if (!isWalking){
				Walk();
			}
			else{			//if it's walking and not waiting
				
				/*vvvvvvvvv- Part to check if there is ground to continue walking in front of the microbe -vvvvvvvvvvv*/
				
				// Calculate the number of objects in the layer Ground that overlap with the given point ( local point (+-0.16, -1.2) placed under the ground, in front of the player) to turn around if it's 0
				//because this means that there is no ground where to continue walking.
				groundPoint = platformTransform.position;		
				
				groundHitsNumber = Physics2D.OverlapPointNonAlloc(groundPoint, groundHits, utils.layerMasks.ground);
				
				if (debugMode) Debug.DrawRay(groundPoint, direction * (-0.2), Color.green, 2);
				//Debug.Log("groundHitsNumber: " + groundHitsNumber);
				if (groundHitsNumber == 0){
					if (debugMode) Debug.Log("Pos: " + groundPoint + " No floor ahead. Turning around...");		
					//Debug.Log("Hit: " + groundHits[0]);
					
					if (!GetComponent.<Renderer>().isVisible){	//If the microbe is not visible
						StopThenFlip();			//Continue walking
					}else{
						LedgeReached();
					}
				}
				
				/*^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^*/
				
			}
		}
	
	}
	
	
	function OnTriggerEnter2D(collisionInfo : Collider2D){
		//var bugName: String = gameObject.name;
		//Debug.Log(bugName +": Trigger enter. \nName: "+ collisionInfo.gameObject.name +"\nLayer:" + collisionInfo.gameObject.layer);
		var collisionLayer: int = collisionInfo.gameObject.layer;
		if(!isWaiting && (	collisionLayer == utils.layers.ground 
							|| collisionLayer == utils.layers.player
							|| collisionLayer == utils.layers.nonEnemies
							|| collisionLayer == utils.layers.enemies)){		//If not waiting and the collision occurred against something in the ground (12th) or player(9th) layer or NonEnemies or Enemies layers...
			//Debug.Log("Trigger enter. Turning around...");
			StopThenFlip();																						//Turn around
		}
		
		checkCollision(collisionInfo.gameObject);
	}
	
	
	function OnCollisionEnter2D(collisionInfo: Collision2D){
		super.OnCollisionEnter2D(collisionInfo);
		
		if (hasJumped)	JumpFinished();
		
		checkCollision(collisionInfo.gameObject);
		
	}
	
	private function checkCollision(collisionObject: GameObject){
		
		var collisionLayer: int = collisionObject.layer;
		
		if( DestroysOnEnemyContact	//If this boolean is true, and an enemie bumps with a non enemie, or the opposite...
			&& GetComponent.<Renderer>().isVisible		//if is visible on the camera...
			&& ( ( gameObject.layer == utils.layers.enemies && collisionLayer == utils.layers.nonEnemies ) || (gameObject.layer == utils.layers.nonEnemies && collisionLayer == utils.layers.enemies) ) ){
			
//			if(gameObject.layer == utils.layers.enemies){
//				this.beWashedAway();	//The bug will be destroyed
//			}else{														//This part of commented code was to wash the baddies and kill the goodies
//				this.beKilled();	//The bug will be destroyed
//			}

			this.beKilled();	//The bug will be destroyed
		}
	}
	
	/*	Makes the character begin walking, playing the walk annimation
	*
	*/
	private function Walk (){
		isWalking = true;
		anim.SetFloat("speed", 1.0); 					//To play the "idle" animation
		iTween.MoveAdd(gameObject, {"x": moveDistance, "speed": Speed, "easetype": EaseType.linear, "oncomplete": "Flip"});
	}

	/*Stops all the animations of this gameObject playing the idle animation for "timeWaiting" seconds. When finished waiting it Flips the character.
	*
	*/
	protected function StopThenFlip (){
		
		isWaiting = true;
		
		isWalking = false;
		iTween.Stop(gameObject);						//Stops all the iTweens of this gameObject
		anim.SetFloat("speed", 0.0); 					//To play the "idle" animation
		yield new WaitForSeconds(timeWaiting);
		if (!killedAlready) Flip();
		
		isWaiting = false;
		
	}
	/*	This function is meant to be executed when some walking microbe has reached a ledge or a cliff and is currently displayed on the screen 
	*	It will check the global boolean variable MustJumpOnLedge to see if it should jump or stop and flip instead. Only a few microbes have the jump Animation! Be careful with this.
	*	All Lucy bacterias supossed to jump to a milk glass MUST have MustJumpOnLedge value to false. Because if it jumps it'll be impossible to push her to the glass anymore.
	*	Three ball staphilococus must override this function, because they have an special behaviour on this situations (bounce instead of jumping)
	*/
	protected function LedgeReached(){
//		Debug.Log("Ledge reached");
		if (!MustJumpOnLedge){
			StopThenFlip ();					//For the microbes that don't jump
		}else{
//			Debug.Log("Jumping on ledge!");
			isWaiting = true;
			isWalking = false;
			
			anim.SetFloat("speed", 0.0); 					//To play the "idle" animation
			iTween.Stop(gameObject);						//Stops all the iTweens of this gameObject
			
			yield new WaitForSeconds(SecondsBeforeJumping);
			direction = facingRight ? Vector2.right : Vector2.right * (-1);			//Updating direction...
//			if (direction.x > 0) Debug.Log("Jumping right");
//			else Debug.Log("Jumping left");
			anim.SetTrigger("jump_start");
			if (facingRight) myTransform.GetComponent.<Rigidbody2D>().AddForce(jumpOnLedgeForce);
			else myTransform.GetComponent.<Rigidbody2D>().AddForce(Vector2(jumpOnLedgeForce.x * (-1), jumpOnLedgeForce.y));
			
			hasJumped = true;
		}
	}
	
	/*	To be called when the microbe lands after a jump on a ledge
	
	*/
	protected function JumpFinished(){
//		Debug.Log("Jump finished");
		anim.SetTrigger("jump_end");
		hasJumped = false;
		if (Random.Range(0, 2) == 0) Flip();		//Flips half of the times
		isWaiting = false;
	}

	/**
	* Flips the texture in the Y axis. Useful to flip the characters when they reach an obstacle.
	*
	*/
	protected function Flip () {
			
		facingRight = !facingRight;						
		direction = facingRight ? Vector2.right : Vector2.right * (-1);
		moveDistance *= -1;								//Change the direction of the movement
		
		var pos: Vector3 = transform.position;			//It's neccesary to move a little bit the bug because the animation is not centered in the sprite
		if(!facingRight) pos.x -= turningOffset;
		else pos.x += turningOffset;
		transform.position = pos;
		var bugScale: Vector3 = transform.localScale;
		bugScale.x *= -1;
		transform.localScale = bugScale;

	}
	
	public function beWashedAway (): IEnumerator {
		if (!killedAlready){
		
			isWaiting = true;
			isWalking = false;
			
			//rigidbody2D.gravityScale = 0;
			GetComponent.<Rigidbody2D>().isKinematic = true;
			disableColliders();
			
			iTween.Stop(gameObject);															//Stops all the iTweens of this gameObject
			
			killedAlready = true;										//'killedAlready' will be true while waiting to avoid this method to execute again
			yield new WaitForSeconds(0.1);								//It's not advisable to stop the tweens and start another tween in the same method
			killedAlready = false;										//Then, to execute the 'beWashedAway' method of the parent class 'killedAlready' is set to false again
			super.beWashedAway();
		}
	}


}