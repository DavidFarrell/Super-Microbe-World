#pragma strict


public class SuperInfection extends Microbe{
	
	public function beHit(){
		//An infection can't be hit the usual way. So this method is overridden to avoid playing the be_hit animation, which this microbe doesn't have.
		
	}
	
	public function receiveAntibiotics(){
		if (affectedByAntibiotics) {
			anim.SetTrigger("antibiotics");
			life = life - antibioticsDamage;
			Debug.Log(myTransform.name + ": Antibiotics hit. Life: " + life);
			if (!killedAlready && life <= 0){
				Debug.Log("SuperInfection killed!");
				goals.UpdateGoals(microbeName, "antibiotics");				//To inform the Goals.js script about the change
				beKilled();
				return;
			}
		}
	}
	
	public function beKilled(){
		if (!killedAlready){
			killedAlready = true;
			disableColliders();
			Destroy(gameObject, 1); //TODO Check this time
		}
	}
	
}